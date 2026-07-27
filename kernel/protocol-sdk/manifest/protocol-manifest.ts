/**
 * @kernel/protocol-sdk/manifest — the ProtocolManifest.
 *
 * RICHER than the M1 `ExtensionManifest`: a protocol is a top-level application
 * installed on the kernel, so its manifest carries full provenance (author,
 * license, homepage, icon), versioning constraints (apiVersion,
 * minimumKernelVersion), dependency declarations, permission requests,
 * declared capabilities/intent-types/extensions, and feature flags.
 *
 * The manifest is IMMUTABLE: once a protocol is defined, its manifest does not
 * change. Upgrading a protocol produces a NEW manifest with a new version.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

/** A semver version string, e.g. `"1.2.3"` or `"1.0.0-beta.1"`. */
export type SemverString = string;

/** A semver range string, e.g. `"^1.2.0"`, `"~1.0.0"`, `">=2.0.0 <3.0.0"`. */
export type SemverRange = string;

/** A dependency on another protocol, by id + version range. */
export interface ProtocolDependency {
  readonly id: string;
  readonly versionRange: SemverRange;
  readonly optional?: boolean;
}

/** A permission a protocol requests from the kernel. */
export interface ProtocolPermission {
  readonly kind:
    | "compiler-stage"
    | "api-route"
    | "ui-extension"
    | "read-model"
    | "analytics"
    | "event-type"
    | "notification"
    | "config"
    | "localization"
    | "marketplace";
  readonly scope: string;
  readonly description?: string;
}

/** The author of a protocol. */
export interface ProtocolAuthor {
  readonly name: string;
  readonly email?: string;
  readonly url?: string;
}

/**
 * The immutable manifest every protocol ships with. Validated before
 * installation; never mutated after.
 */
export interface ProtocolManifest {
  /** Namespaced protocol id, e.g. `"opsos.protocol.cleaning"`. */
  readonly id: string;
  /** Machine name / slug. */
  readonly name: string;
  /** Human-readable display name. */
  readonly displayName: string;
  readonly description: string;
  /** Semver version of THIS protocol. */
  readonly version: SemverString;
  /** Kernel API version this protocol targets, e.g. `"1.0.0"`. */
  readonly apiVersion: SemverString;
  readonly author: ProtocolAuthor;
  readonly license: string;
  readonly homepage?: string;
  readonly icon?: string;
  /** Minimum kernel version required to install this protocol. */
  readonly minimumKernelVersion: SemverString;
  /** Other protocols this one depends on. */
  readonly dependencies: readonly ProtocolDependency[];
  /** Kernel permissions this protocol requests. */
  readonly permissions: readonly ProtocolPermission[];
  /** Capability type IDs this protocol declares. */
  readonly capabilities: readonly string[];
  /** Intent type IDs this protocol declares. */
  readonly intentTypes: readonly string[];
  /** Extension point IDs this protocol uses. */
  readonly extensions: readonly string[];
  /** Feature flags the protocol ships with (default values). */
  readonly featureFlags: Readonly<Record<string, boolean>>;
}

/** The current kernel API version protocols target. */
export const KERNEL_API_VERSION = "1.0.0";

/** The current kernel implementation version. */
export const KERNEL_VERSION = "1.2.0";
