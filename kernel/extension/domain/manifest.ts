/**
 * @kernel/extension/domain/manifest — extension manifest contracts.
 *
 * An `ExtensionManifest` is the immutable descriptor every extension (a
 * protocol plugin) ships with. It declares identity (id, version, name),
 * provenance (`protocolId` — present iff this is a protocol plugin),
 * dependencies (other extensions by id + semver-ish range), what it provides
 * (capability / intent types), and the kernel version it targets.
 *
 * Per ADR-0006, Milestone 1 ships the host + registry + contracts ONLY — NO
 * protocol plugins. The manifest is the contract protocols will declare
 * against in a later milestone.
 *
 * Pure domain layer: depends ONLY on `@kernel/shared-kernel` (`Result` /
 * `KernelError` / `ValidationError`). No I/O, no `Date.now()`, no
 * `Math.random()`. `validateManifest` is pure given the manifest.
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";

/**
 * Namespaced extension identifier, e.g. `"opsos.protocol.cleaning"`.
 *
 * Aliased as a distinct type (rather than a branded string) so the kernel
 * stays decoupled — extension ids are self-certifying strings chosen by the
 * protocol author, not kernel-branded identifiers.
 */
export type ExtensionId = string;

/**
 * A dependency on another extension, declared by id + a semver-ish range
 * string (e.g. `^1.2.0`, `>=2.0.0 <3.0.0`). The host does NOT resolve
 * dependency ranges in Milestone 1 — it records them for future
 * marketplace / lifecycle tooling.
 */
export interface ExtensionDependency {
  readonly id: ExtensionId;
  /** Semver-ish range string, e.g. `^1.2.0` or `>=2.0.0 <3.0.0`. */
  readonly versionRange: string;
}

/**
 * Immutable manifest declared by every extension.
 *
 * `protocolId` is present iff this is a protocol plugin (a top-level
 * application installed on the kernel); non-protocol extensions (e.g. a
 * UI-only add-on) leave it absent.
 *
 * `provides` lists the capability / intent types this extension contributes
 * to the kernel's catalogue — used by the registry's `listProviding` query
 * helper.
 */
export interface ExtensionManifest {
  readonly id: ExtensionId;
  /** Semver version string, e.g. `1.2.0`. */
  readonly version: string;
  readonly name: string;
  readonly description?: string;
  /** Present iff this is a protocol plugin. */
  readonly protocolId?: string;
  readonly dependencies: readonly ExtensionDependency[];
  /** Capability / intent types provided by this extension. */
  readonly provides: readonly string[];
  readonly kernelVersion?: string;
}

/**
 * Pure structural validation of an `ExtensionManifest`.
 *
 * Checks: `id` non-empty, `version` present, `name` non-empty. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 *
 * NO I/O, NO `Date.now()`, NO `Math.random()` — deterministic in the
 * manifest. The manifest is the ONLY input; the same manifest always yields
 * the same result.
 */
export function validateManifest(
  manifest: ExtensionManifest
): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!manifest.id || manifest.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  if (!manifest.version || manifest.version.trim() === "") {
    details.push({ field: "version", reason: "must be present" });
  }
  if (!manifest.name || manifest.name.trim() === "") {
    details.push({ field: "name", reason: "must be non-empty" });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid extension manifest", details));
  }
  return ok(undefined);
}
