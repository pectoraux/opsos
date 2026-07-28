/**
 * @kernel/composition/domain/package-artifact — `PackageArtifact`,
 * `PackageContents`, `PackageDigest`.
 *
 * The immutable BUILT artifact of the composition pipeline. A
 * `PackageArtifact` is the in-memory representation of a `.opspkg` file: a
 * manifest + bundled contents + a digest + an optional signature.
 *
 *   `manifest`   — `PackageManifest` (id, version, provenance, deps).
 *   `contents`   — `PackageContents` (the bundled contributions: domain
 *                  bindings, knowledge refs, compiler extensions, policies,
 *                  capabilities, workflows, resources, measurements, UI,
 *                  APIs, analytics, config defaults).
 *   `digest`     — `PackageDigest` (deterministic hash of `contents`).
 *   `signature`  — optional `PackageSignature` (attestation by a signer).
 *
 * Pure domain layer. All fields are readonly, immutable, serialisable.
 */

import type { PackageManifest } from "./package-manifest";
import type { PackageSignature } from "./package-signature";

/**
 * The bundled contents of a package. Every field is an immutable, serialisable
 * reference list (or map) — NO functions, NO class instances, NO `Date`s.
 *
 *   `domainBindings`        — `entityTypeId → domainId` map. Declares which
 *                              domain definition backs each entity type the
 *                              package uses.
 *   `knowledgeRefs`         — ids of knowledge items (procedures, regulations,
 *                              facts) the package binds to.
 *   `compilerExtensions`    — compiler stage refs the package contributes.
 *   `policies`              — policy ids the package registers.
 *   `capabilities`          — capability ids the package declares.
 *   `workflows`             — workflow ids the package registers.
 *   `resourceRequirements`  — resource type refs the package needs.
 *   `measurements`          — measurement metric refs the package emits.
 *   `uiExtensions`          — mount point refs the package contributes.
 *   `apiRoutes`             — route refs the package exposes.
 *   `analytics`             — metric name refs the package emits.
 *   `configDefaults`        — opaque, serialisable config defaults map.
 */
export interface PackageContents {
  readonly domainBindings: Readonly<Record<string, string>>;
  readonly knowledgeRefs: readonly string[];
  readonly compilerExtensions: readonly string[];
  readonly policies: readonly string[];
  readonly capabilities: readonly string[];
  readonly workflows: readonly string[];
  readonly resourceRequirements: readonly string[];
  readonly measurements: readonly string[];
  readonly uiExtensions: readonly string[];
  readonly apiRoutes: readonly string[];
  readonly analytics: readonly string[];
  readonly configDefaults: Readonly<Record<string, unknown>>;
}

/** An empty `PackageContents` — convenient starting point for builders. */
export const EMPTY_PACKAGE_CONTENTS: PackageContents = {
  domainBindings: {},
  knowledgeRefs: [],
  compilerExtensions: [],
  policies: [],
  capabilities: [],
  workflows: [],
  resourceRequirements: [],
  measurements: [],
  uiExtensions: [],
  apiRoutes: [],
  analytics: [],
  configDefaults: {},
};

/**
 * A digest (hash) over a `PackageContents`. The `algorithm` identifies the
 * hash function used (e.g. `"djb2-demo"`, `"sha256"`); the `hash` is the
 * hex-encoded digest.
 */
export interface PackageDigest {
  readonly algorithm: string;
  readonly hash: string;
}

/**
 * A `PackageArtifact` — the immutable in-memory representation of a `.opspkg`.
 * Aliased as `OperationalPackage` for clarity in installer / registry APIs.
 */
export interface PackageArtifact {
  readonly manifest: PackageManifest;
  readonly contents: PackageContents;
  readonly digest: PackageDigest;
  readonly signature?: PackageSignature;
}
