/**
 * @kernel/protocol-sdk/manifest/manifest-validation — deep validation of a
 * ProtocolManifest with detailed diagnostics.
 *
 * Validates: id format, semver fields, author, license, kernel version
 * constraint satisfiability, dependency id uniqueness, permission scopes, and
 * feature flag keys. Produces a list of `ManifestDiagnostic` records (never
 * throws). The caller decides whether `error`-severity diagnostics block
 * installation.
 */

import type { ProtocolManifest } from "./protocol-manifest";
import { isValidSemver, satisfiesRange } from "../validation/versioning";
import type { SdkDiagnostic, DiagnosticSeverity } from "../validation/diagnostic";

export type ManifestDiagnostic = SdkDiagnostic;

/** Validate a manifest structurally + semantically. Returns diagnostics. */
export function validateProtocolManifest(
  manifest: ProtocolManifest,
  kernelVersion: string
): readonly ManifestDiagnostic[] {
  const diags: ManifestDiagnostic[] = [];
  const push = (
    severity: DiagnosticSeverity,
    field: string,
    message: string
  ) =>
    diags.push({
      severity,
      code: `MANIFEST_${field.toUpperCase()}`,
      message: `${field}: ${message}`,
      source: "manifest-validation",
    });

  // ── Identity ──────────────────────────────────────────────────────────────
  if (!manifest.id || manifest.id.trim() === "") {
    push("error", "id", "must be non-empty");
  } else if (!/^[a-z0-9]+(?:\.[a-z0-9]+)+$/.test(manifest.id)) {
    push(
      "error",
      "id",
      "must be a dot-separated namespaced identifier (e.g. 'opsos.protocol.cleaning')"
    );
  }

  if (!manifest.name || manifest.name.trim() === "") {
    push("error", "name", "must be non-empty");
  }
  if (!manifest.displayName || manifest.displayName.trim() === "") {
    push("error", "displayName", "must be non-empty");
  }
  if (!manifest.description || manifest.description.trim() === "") {
    push("warn", "description", "should be non-empty");
  }

  // ── Versioning ────────────────────────────────────────────────────────────
  if (!isValidSemver(manifest.version)) {
    push("error", "version", `'${manifest.version}' is not a valid semver`);
  }
  if (!isValidSemver(manifest.apiVersion)) {
    push("error", "apiVersion", `'${manifest.apiVersion}' is not a valid semver`);
  }
  if (!isValidSemver(manifest.minimumKernelVersion)) {
    push(
      "error",
      "minimumKernelVersion",
      `'${manifest.minimumKernelVersion}' is not a valid semver`
    );
  } else if (!satisfiesRange(kernelVersion, `>=${manifest.minimumKernelVersion}`)) {
    push(
      "error",
      "minimumKernelVersion",
      `kernel ${kernelVersion} does not satisfy >=${manifest.minimumKernelVersion}`
    );
  }

  // ── Author / license ─────────────────────────────────────────────────────
  if (!manifest.author || !manifest.author.name || manifest.author.name.trim() === "") {
    push("error", "author", "author.name must be non-empty");
  }
  if (!manifest.license || manifest.license.trim() === "") {
    push("error", "license", "must be non-empty (e.g. 'MIT', 'Apache-2.0')");
  }

  // ── Dependencies ─────────────────────────────────────────────────────────
  const depIds = new Set<string>();
  for (const dep of manifest.dependencies) {
    if (!dep.id || dep.id.trim() === "") {
      push("error", "dependencies", "dependency id must be non-empty");
      continue;
    }
    if (depIds.has(dep.id)) {
      push("error", "dependencies", `duplicate dependency '${dep.id}'`);
    }
    depIds.add(dep.id);
  }

  // ── Permissions ──────────────────────────────────────────────────────────
  const permKeys = new Set<string>();
  for (const perm of manifest.permissions) {
    const key = `${perm.kind}:${perm.scope}`;
    if (permKeys.has(key)) {
      push("warn", "permissions", `duplicate permission '${key}'`);
    }
    permKeys.add(key);
  }

  // ── Feature flags ────────────────────────────────────────────────────────
  for (const key of Object.keys(manifest.featureFlags)) {
    if (typeof manifest.featureFlags[key] !== "boolean") {
      push("error", "featureFlags", `flag '${key}' must be boolean`);
    }
  }

  return diags;
}

/** Convenience: true if a manifest has zero `error`-severity diagnostics. */
export function manifestIsValid(
  manifest: ProtocolManifest,
  kernelVersion: string
): boolean {
  return validateProtocolManifest(manifest, kernelVersion).every(
    (d) => d.severity !== "error"
  );
}
