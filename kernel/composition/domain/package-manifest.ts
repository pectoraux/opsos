/**
 * @kernel/composition/domain/package-manifest — `PackageManifest`, the immutable
 * descriptor of an `OperationalPackage` (`.opspkg`).
 *
 * Where `ProtocolManifest` (from `@kernel/protocol-sdk`) describes the protocol
 * SOURCE, `PackageManifest` describes the BUILT artifact — analogous to the
 * difference between a Dockerfile (source) and a Docker image manifest (built
 * artifact). The composition pipeline produces a `PackageManifest` from a
 * `ProtocolManifest` plus build metadata.
 *
 * The manifest is IMMUTABLE: once a package is built, its manifest never
 * changes. Upgrading a protocol produces a NEW manifest with a new version.
 *
 * Pure domain layer. No I/O, no `Date.now()`, no `Math.random()`.
 */

import type { PackageDependency } from "./package-dependency";

/**
 * The author of a package. Mirrors `ProtocolAuthor` but is owned by the
 * composition layer (a package author may differ from the original protocol
 * author when a third party repackages a protocol).
 */
export interface PackageAuthor {
  readonly name: string;
  readonly url?: string;
}

/**
 * A `PackageManifest` — the immutable descriptor of a built `OperationalPackage`.
 *
 *   `id`               — namespaced package id, e.g. `"opsos.protocol.cleaning"`.
 *                        Usually (but not necessarily) identical to the source
 *                        protocol id — packages may be repackaged under a
 *                        different namespace.
 *   `name`             — machine name / slug.
 *   `displayName`      — human-readable display name.
 *   `version`          — semver version of THIS package build.
 *   `apiVersion`       — kernel API version this package targets.
 *   `kernelVersion`    — kernel implementation version the package was built
 *                        against (informational; used for reproducibility).
 *   `domainVersion`    — optional version of the bound `DomainDefinition`.
 *   `protocolVersion`  — version of the source `ProtocolManifest`.
 *   `knowledgeVersion` — optional version stamp of the bound knowledge refs.
 *   `author`           — package author (provenance).
 *   `license`          — SPDX license string.
 *   `dependencies`     — other packages this one depends on.
 *   `permissions`      — kernel permission strings (e.g. `"compiler-stage:..."`).
 *   `buildMetadata`    — opaque, serialisable build metadata (compiler flags,
 *                        source revision, environment markers — never functions).
 *   `buildTimestamp`   — epoch milliseconds at build time (sourced from the
 *                        `now` argument of the composition input — never
 *                        `Date.now()`).
 *   `compilerVersion`  — version of the composition compiler that built this.
 */
export interface PackageManifest {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly version: string;
  readonly apiVersion: string;
  readonly kernelVersion: string;
  readonly domainVersion?: string;
  readonly protocolVersion: string;
  readonly knowledgeVersion?: string;
  readonly author: PackageAuthor;
  readonly license: string;
  readonly dependencies: readonly PackageDependency[];
  readonly permissions: readonly string[];
  readonly buildMetadata: Readonly<Record<string, unknown>>;
  readonly buildTimestamp: number;
  readonly compilerVersion: string;
}

/** The current composition compiler version. */
export const COMPOSITION_COMPILER_VERSION = "1.0.0";
