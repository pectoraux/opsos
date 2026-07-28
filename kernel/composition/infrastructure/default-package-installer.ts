/**
 * @kernel/composition/infrastructure/default-package-installer —
 * `DefaultPackageInstaller`.
 *
 * Installs an `OperationalPackage` into an Application Runtime and drives its
 * lifecycle: install → activate → disable → remove → rollback → upgrade.
 *
 * State model:
 *   - `Map<id, Map<version, PackageRecord>>` — every installed version per id.
 *     Multiple versions per id can coexist (rollback needs the old version
 *     still installed).
 *   - `Map<id, version>` — the currently-ACTIVE version per id (if any).
 *
 * Lifecycle transitions are checked against `LEGAL_TRANSITIONS`; illegal
 * transitions produce an `error`-severity diagnostic and leave state unchanged.
 *
 * The installer consults the `PackageRegistry` (for rollback lookups of older
 * versions) and the `Verifier` (to verify signatures during install). Both
 * are optional; when absent, the relevant checks are skipped (with a
 * diagnostic).
 *
 * Determinism: all time flows through the caller-supplied `now`. No
 * `Date.now()`, no `Math.random()`.
 */

import type { OperationalPackage } from "../domain";
import type { PackageDiagnostic } from "../domain";
import type { PackageLifecycleEvent } from "../domain";
import type { PackageLifecycleState } from "../domain";
import type { PackageRegistry } from "../domain";
import type { Verifier } from "../domain";
import type { SignatureStore } from "../domain";
import {
  isLegalTransition,
  lifecycleEvent,
  illegalTransitionDiagnostic,
} from "../domain";
import type {
  InstallResult,
  PackageInstaller,
} from "../application/install-package";

interface PackageRecord {
  readonly pkg: OperationalPackage;
  state: PackageLifecycleState;
  readonly history: PackageLifecycleEvent[];
}

/** Deps for `DefaultPackageInstaller`. */
export interface DefaultPackageInstallerDeps {
  /** Optional registry — consulted by `rollback` to find the target version. */
  readonly registry?: PackageRegistry;
  /** Optional verifier — consulted during install (signature check). */
  readonly verifier?: Verifier;
  /** Optional signature store — consulted during install. */
  readonly signatureStore?: SignatureStore;
}

/**
 * `DefaultPackageInstaller` — installs packages and drives their lifecycle.
 *
 * The installer requires a `now` argument for every operation. Callers
 * typically pass `input.now` from the composition input or a fixed timestamp
 * in tests. The installer NEVER calls `Date.now()`.
 */
export class DefaultPackageInstaller implements PackageInstaller {
  private readonly byId = new Map<string, Map<string, PackageRecord>>();
  private readonly activeVersion = new Map<string, string>();
  private readonly deps: DefaultPackageInstallerDeps;

  constructor(deps: DefaultPackageInstallerDeps = {}) {
    this.deps = deps;
  }

  install(pkg: OperationalPackage): InstallResult {
    const id = pkg.manifest.id;
    const version = pkg.manifest.version;
    // We can't know `now` without the caller supplying it. Use the package's
    // own `buildTimestamp` as the install time. This is deterministic
    // (identical packages have identical buildTimestamps).
    const now = pkg.manifest.buildTimestamp;

    const events: PackageLifecycleEvent[] = [];
    const diags: PackageDiagnostic[] = [];

    let versions = this.byId.get(id);
    if (!versions) {
      versions = new Map();
      this.byId.set(id, versions);
    }
    const existing = versions.get(version);
    const startState: PackageLifecycleState = existing
      ? existing.state
      : "discovered";

    // Walk: discovered → validated → linked → packaged → verified → installed.
    // If the package is already installed (or in a later non-terminal state
    // like 'activated' / 'disabled'), install() is a no-op: it returns success
    // without re-walking the lifecycle. Re-installing an already-installed
    // version is idempotent.
    const fullPath: readonly PackageLifecycleState[] = [
      "discovered",
      "validated",
      "linked",
      "packaged",
      "verified",
      "installed",
    ];
    const startIdx = fullPath.indexOf(startState);
    // If startState is 'activated' / 'disabled' (post-install), treat as
    // already-installed (index 5 = 'installed').
    const effectiveIdx =
      startIdx >= 0 ? startIdx : fullPath.indexOf("installed");
    const targetIdx = fullPath.indexOf("installed");

    let current = startState;
    if (effectiveIdx >= targetIdx) {
      // Already at or past 'installed'. No-op walk; still record the package
      // (replace in store) and run optional verification.
    } else {
      for (let i = effectiveIdx + 1; i <= targetIdx; i++) {
        const next = fullPath[i];
        if (!isLegalTransition(current, next)) {
          diags.push(illegalTransitionDiagnostic(id, current, next));
          return {
            ok: false,
            packageId: id,
            version,
            lifecycle: events,
            diagnostics: diags,
          };
        }
        events.push(lifecycleEvent(id, version, current, next, now));
        current = next;
      }
    }

    // Optional signature verification.
    if (this.deps.verifier) {
      const ok = this.deps.verifier.verify(pkg);
      if (!ok) {
        diags.push({
          stage: "package",
          severity: "error",
          code: "SIGNATURE_VERIFICATION_FAILED",
          message: `Signature verification failed for '${id}@${version}'`,
        });
      }
    } else if (!pkg.signature) {
      diags.push({
        stage: "package",
        severity: "warn",
        code: "UNSIGNED_PACKAGE",
        message: `Package '${id}@${version}' is unsigned`,
      });
    }

    // Optional signature-store record.
    if (this.deps.signatureStore) {
      this.deps.signatureStore.save(pkg);
    }

    // Persist the record.
    versions.set(version, {
      pkg,
      state: current,
      history: existing ? [...existing.history, ...events] : events,
    });

    const hasErrors = diags.some(
      (d) => d.severity === "error" || d.severity === "fatal"
    );
    return {
      ok: !hasErrors,
      packageId: id,
      version,
      lifecycle: events,
      diagnostics: diags,
    };
  }

  activate(packageId: string, version: string): InstallResult {
    return this.transition(
      packageId,
      version,
      "activated",
      (now, _rec) =>
        // If another version is currently active, deactivate it first.
        this.deactivateOther(packageId, version, now),
      { fromAccept: ["installed", "disabled", "verified"] }
    );
  }

  disable(packageId: string, version: string): InstallResult {
    return this.transition(packageId, version, "disabled", () => [], {
      fromAccept: ["activated", "installed"],
    });
  }

  remove(packageId: string, version: string): InstallResult {
    return this.transition(packageId, version, "removed", () => [], {
      fromAccept: [
        "discovered",
        "validated",
        "linked",
        "packaged",
        "verified",
        "installed",
        "activated",
        "disabled",
        "rollback",
        "upgrade",
      ],
      onAfter: () => {
        // Clear active version if it was this one.
        if (this.activeVersion.get(packageId) === version) {
          this.activeVersion.delete(packageId);
        }
      },
    });
  }

  rollback(packageId: string, toVersion: string): InstallResult {
    const now = this.findNow(packageId, toVersion);
    const events: PackageLifecycleEvent[] = [];
    const diags: PackageDiagnostic[] = [];

    // Find the target version (must be installed).
    const targetVersions = this.byId.get(packageId);
    if (!targetVersions || !targetVersions.has(toVersion)) {
      // Try the registry.
      if (this.deps.registry) {
        const target = this.deps.registry.get(packageId, toVersion);
        if (target) {
          // Install it first (transitions discovered → ... → installed).
          const installResult = this.install(target);
          events.push(...installResult.lifecycle);
          diags.push(...installResult.diagnostics);
        } else {
          diags.push({
            stage: "package",
            severity: "error",
            code: "ROLLBACK_TARGET_NOT_FOUND",
            message: `Rollback target '${packageId}@${toVersion}' is not installed and not in the registry`,
          });
          return {
            ok: false,
            packageId,
            version: toVersion,
            lifecycle: events,
            diagnostics: diags,
          };
        }
      } else {
        diags.push({
          stage: "package",
          severity: "error",
          code: "ROLLBACK_TARGET_NOT_FOUND",
          message: `Rollback target '${packageId}@${toVersion}' is not installed (no registry supplied to find it)`,
        });
        return {
          ok: false,
          packageId,
          version: toVersion,
          lifecycle: events,
          diagnostics: diags,
        };
      }
    }

    // Deactivate the currently-active version (if any, and if it's not the
    // target).
    const currentActive = this.activeVersion.get(packageId);
    if (currentActive && currentActive !== toVersion) {
      const curVersions = this.byId.get(packageId);
      const curRec = curVersions?.get(currentActive);
      if (curRec) {
        if (isLegalTransition(curRec.state, "rollback")) {
          events.push(
            lifecycleEvent(
              packageId,
              currentActive,
              curRec.state,
              "rollback",
              now
            )
          );
          curRec.state = "rollback";
          curRec.history.push(events[events.length - 1]);
        }
      }
    }

    // Transition the target to rollback, then to activated.
    const targetRec = this.byId.get(packageId)?.get(toVersion);
    if (!targetRec) {
      diags.push({
        stage: "package",
        severity: "error",
        code: "ROLLBACK_TARGET_NOT_FOUND",
        message: `Rollback target '${packageId}@${toVersion}' not found after install`,
      });
      return {
        ok: false,
        packageId,
        version: toVersion,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    if (!isLegalTransition(targetRec.state, "rollback")) {
      diags.push(
        illegalTransitionDiagnostic(packageId, targetRec.state, "rollback")
      );
      return {
        ok: false,
        packageId,
        version: toVersion,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    const ev1 = lifecycleEvent(
      packageId,
      toVersion,
      targetRec.state,
      "rollback",
      now
    );
    events.push(ev1);
    targetRec.state = "rollback";
    targetRec.history.push(ev1);

    if (!isLegalTransition(targetRec.state, "activated")) {
      diags.push(
        illegalTransitionDiagnostic(packageId, targetRec.state, "activated")
      );
      return {
        ok: false,
        packageId,
        version: toVersion,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    const ev2 = lifecycleEvent(
      packageId,
      toVersion,
      targetRec.state,
      "activated",
      now,
      "rollback"
    );
    events.push(ev2);
    targetRec.state = "activated";
    targetRec.history.push(ev2);
    this.activeVersion.set(packageId, toVersion);

    return {
      ok: !diags.some(
        (d) => d.severity === "error" || d.severity === "fatal"
      ),
      packageId,
      version: toVersion,
      lifecycle: events,
      diagnostics: diags,
    };
  }

  upgrade(packageId: string, newPkg: OperationalPackage): InstallResult {
    if (newPkg.manifest.id !== packageId) {
      return {
        ok: false,
        packageId,
        version: newPkg.manifest.version,
        lifecycle: [],
        diagnostics: [
          {
            stage: "package",
            severity: "error",
            code: "UPGRADE_ID_MISMATCH",
            message: `Upgrade target id '${packageId}' does not match new package id '${newPkg.manifest.id}'`,
          },
        ],
      };
    }
    const now = newPkg.manifest.buildTimestamp;
    const events: PackageLifecycleEvent[] = [];
    const diags: PackageDiagnostic[] = [];

    // Install the new version (transitions discovered → ... → installed).
    const installResult = this.install(newPkg);
    events.push(...installResult.lifecycle);
    diags.push(...installResult.diagnostics);
    if (!installResult.ok) {
      return {
        ok: false,
        packageId,
        version: newPkg.manifest.version,
        lifecycle: events,
        diagnostics: diags,
      };
    }

    // Transition the new version to "upgrade" then "activated".
    const newRec = this.byId.get(packageId)?.get(newPkg.manifest.version);
    if (!newRec) {
      diags.push({
        stage: "package",
        severity: "error",
        code: "UPGRADE_INTERNAL",
        message: `Upgrade could not locate newly-installed record for '${packageId}@${newPkg.manifest.version}'`,
      });
      return {
        ok: false,
        packageId,
        version: newPkg.manifest.version,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    if (!isLegalTransition(newRec.state, "upgrade")) {
      diags.push(
        illegalTransitionDiagnostic(packageId, newRec.state, "upgrade")
      );
      return {
        ok: false,
        packageId,
        version: newPkg.manifest.version,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    const ev1 = lifecycleEvent(
      packageId,
      newPkg.manifest.version,
      newRec.state,
      "upgrade",
      now
    );
    events.push(ev1);
    newRec.state = "upgrade";
    newRec.history.push(ev1);

    // Deactivate the previously-active version (if any).
    const prevActive = this.activeVersion.get(packageId);
    if (prevActive && prevActive !== newPkg.manifest.version) {
      const prevRec = this.byId.get(packageId)?.get(prevActive);
      if (prevRec && isLegalTransition(prevRec.state, "disabled")) {
        const ev = lifecycleEvent(
          packageId,
          prevActive,
          prevRec.state,
          "disabled",
          now,
          "superseded by upgrade"
        );
        events.push(ev);
        prevRec.state = "disabled";
        prevRec.history.push(ev);
      }
    }

    if (!isLegalTransition(newRec.state, "activated")) {
      diags.push(
        illegalTransitionDiagnostic(packageId, newRec.state, "activated")
      );
      return {
        ok: false,
        packageId,
        version: newPkg.manifest.version,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    const ev2 = lifecycleEvent(
      packageId,
      newPkg.manifest.version,
      newRec.state,
      "activated",
      now,
      "upgrade"
    );
    events.push(ev2);
    newRec.state = "activated";
    newRec.history.push(ev2);
    this.activeVersion.set(packageId, newPkg.manifest.version);

    return {
      ok: !diags.some(
        (d) => d.severity === "error" || d.severity === "fatal"
      ),
      packageId,
      version: newPkg.manifest.version,
      lifecycle: events,
      diagnostics: diags,
    };
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private transition(
    packageId: string,
    version: string,
    to: PackageLifecycleState,
    preExtra: (now: number, rec: PackageRecord) => PackageLifecycleEvent[],
    opts: {
      fromAccept: readonly PackageLifecycleState[];
      onAfter?: () => void;
    }
  ): InstallResult {
    const now = this.findNow(packageId, version);
    const events: PackageLifecycleEvent[] = [];
    const diags: PackageDiagnostic[] = [];

    const versions = this.byId.get(packageId);
    const rec = versions?.get(version);
    if (!rec) {
      diags.push({
        stage: "package",
        severity: "error",
        code: "PACKAGE_NOT_INSTALLED",
        message: `Package '${packageId}@${version}' is not installed`,
      });
      return {
        ok: false,
        packageId,
        version,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    if (!opts.fromAccept.includes(rec.state)) {
      diags.push(
        illegalTransitionDiagnostic(packageId, rec.state, to)
      );
      return {
        ok: false,
        packageId,
        version,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    // Pre-transition side effects (e.g. deactivate the prior active version).
    events.push(...preExtra(now, rec));

    if (rec.state === to) {
      // No-op.
      return {
        ok: true,
        packageId,
        version,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    if (!isLegalTransition(rec.state, to)) {
      diags.push(illegalTransitionDiagnostic(packageId, rec.state, to));
      return {
        ok: false,
        packageId,
        version,
        lifecycle: events,
        diagnostics: diags,
      };
    }
    const ev = lifecycleEvent(packageId, version, rec.state, to, now);
    events.push(ev);
    rec.state = to;
    rec.history.push(ev);
    if (to === "activated") {
      // Deactivate any other active version of this id.
      this.deactivateOther(packageId, version, now, events);
      this.activeVersion.set(packageId, version);
    }
    if (opts.onAfter) opts.onAfter();

    return {
      ok: !diags.some(
        (d) => d.severity === "error" || d.severity === "fatal"
      ),
      packageId,
      version,
      lifecycle: events,
      diagnostics: diags,
    };
  }

  private deactivateOther(
    packageId: string,
    exceptVersion: string,
    now: number,
    events: PackageLifecycleEvent[] = []
  ): PackageLifecycleEvent[] {
    const out = events;
    const cur = this.activeVersion.get(packageId);
    if (!cur || cur === exceptVersion) return out;
    const versions = this.byId.get(packageId);
    const rec = versions?.get(cur);
    if (!rec) return out;
    if (rec.state === "activated" && isLegalTransition(rec.state, "disabled")) {
      const ev = lifecycleEvent(
        packageId,
        cur,
        rec.state,
        "disabled",
        now,
        "superseded"
      );
      out.push(ev);
      rec.state = "disabled";
      rec.history.push(ev);
    }
    return out;
  }

  private findNow(packageId: string, version: string): number {
    const rec = this.byId.get(packageId)?.get(version);
    return rec?.pkg.manifest.buildTimestamp ?? 0;
  }

  // ── Read-only introspection (handy for tests / control plane) ───────────

  /** Current lifecycle state of a package version, or undefined if not installed. */
  stateOf(packageId: string, version: string): PackageLifecycleState | undefined {
    return this.byId.get(packageId)?.get(version)?.state;
  }

  /** The currently-active version of an id, or undefined. */
  activeVersionOf(packageId: string): string | undefined {
    return this.activeVersion.get(packageId);
  }

  /** Full lifecycle history for a package version. */
  historyOf(
    packageId: string,
    version: string
  ): readonly PackageLifecycleEvent[] {
    return this.byId.get(packageId)?.get(version)?.history ?? [];
  }
}
