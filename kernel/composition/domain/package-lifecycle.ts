/**
 * @kernel/composition/domain/package-lifecycle — `PackageLifecycleState` and
 * `PackageLifecycleEvent`.
 *
 * An installed `OperationalPackage` moves through a deterministic lifecycle.
 * The installer (`PackageInstaller`) records a `PackageLifecycleEvent` for
 * every transition and refuses illegal transitions with a diagnostic.
 *
 * The lifecycle (with legal transitions) is:
 *
 *   discovered ──→ validated ──→ linked ──→ packaged ──→ verified
 *        │                                                │
 *        └──────────────→ installed ←─────────────────────┘
 *                              │
 *                              ├──→ activated ←── disabled
 *                              │        │             │
 *                              │        └──→ disabled ─┘
 *                              │
 *                              ├──→ removed (terminal)
 *                              │
 *                              ├──→ rollback → activated
 *                              │
 *                              └──→ upgrade → activated (with new package)
 *
 * Transitions are NOT a free-for-all: see `LEGAL_TRANSITIONS` for the exact
 * set. Illegal transitions produce an `error`-severity diagnostic and leave
 * the state unchanged.
 *
 * Pure domain layer.
 */

import type { PackageDiagnostic } from "./package-diagnostics";

/**
 * The lifecycle state of an installed package.
 *
 *   `discovered`  — known to exist; not yet validated.
 *   `validated`   — passed validation.
 *   `linked`      — references resolved.
 *   `packaged`    — bundled into a `PackageArtifact`.
 *   `verified`    — signature/digest verified.
 *   `installed`   — installed into the runtime (not yet active).
 *   `activated`   — live and serving.
 *   `disabled`    — installed but deactivated (can be re-activated).
 *   `removed`     — uninstalled (terminal).
 *   `rollback`    — transient state during rollback (transitions to activated).
 *   `upgrade`     — transient state during upgrade (transitions to activated).
 */
export type PackageLifecycleState =
  | "discovered"
  | "validated"
  | "linked"
  | "packaged"
  | "verified"
  | "installed"
  | "activated"
  | "disabled"
  | "removed"
  | "rollback"
  | "upgrade";

/**
 * The legal-transition table. `LEGAL_TRANSITIONS[from]` is the set of states
 * `from` is allowed to transition TO. Pure data — used by both the installer
 * and any other component that needs to reason about lifecycle legality.
 */
export const LEGAL_TRANSITIONS: Readonly<
  Record<PackageLifecycleState, readonly PackageLifecycleState[]>
> = {
  discovered: ["validated", "removed"],
  validated: ["linked", "removed"],
  linked: ["packaged", "removed"],
  packaged: ["verified", "removed"],
  verified: ["installed", "removed"],
  installed: ["activated", "disabled", "removed", "rollback", "upgrade"],
  activated: ["disabled", "removed", "rollback", "upgrade"],
  disabled: ["activated", "removed", "rollback", "upgrade"],
  rollback: ["activated", "removed"],
  upgrade: ["activated", "removed"],
  removed: [],
};

/** True iff transitioning `from → to` is legal. */
export function isLegalTransition(
  from: PackageLifecycleState,
  to: PackageLifecycleState
): boolean {
  if (from === to) return true; // no-op is always legal
  const allowed = LEGAL_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * A lifecycle event recorded by the installer. The installer returns the
 * full sequence of events for an operation so callers can audit what
 * happened.
 *
 *   `packageId`  — the package id.
 *   `version`    — the package version.
 *   `from`       — the state before the transition.
 *   `to`         — the state after the transition.
 *   `at`         — epoch milliseconds (sourced from the caller's `now`).
 *   `reason`     — optional human-readable reason.
 */
export interface PackageLifecycleEvent {
  readonly packageId: string;
  readonly version: string;
  readonly from: PackageLifecycleState;
  readonly to: PackageLifecycleState;
  readonly at: number;
  readonly reason?: string;
}

/** Construct a `PackageLifecycleEvent`. Pure helper. */
export function lifecycleEvent(
  packageId: string,
  version: string,
  from: PackageLifecycleState,
  to: PackageLifecycleState,
  at: number,
  reason?: string
): PackageLifecycleEvent {
  return { packageId, version, from, to, at, reason };
}

/** Convenience: build a diagnostic for an illegal transition. */
export function illegalTransitionDiagnostic(
  packageId: string,
  from: PackageLifecycleState,
  to: PackageLifecycleState
): PackageDiagnostic {
  return {
    stage: "package",
    severity: "error",
    code: "ILLEGAL_TRANSITION",
    message: `Package '${packageId}' cannot transition ${from} → ${to}`,
  };
}
