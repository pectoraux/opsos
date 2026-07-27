/**
 * @kernel/api — versioned public API of the OpsOS kernel.
 *
 * The kernel exposes its public contract through *versioned* API barrels.
 * External consumers (protocols, applications, the admin console, tests) MUST
 * import from `@kernel/api/v1` — never from internal `@kernel/<module>` paths.
 *
 *   import { compile, ExecutionGraph, Intent } from "@kernel/api/v1";
 *
 * Versioning policy (ADR-0009):
 *
 *   - `v1` is FROZEN. Breaking changes to any v1 export require a new version
 *     directory (`v2/`) and a migration path. v1 continues to exist unchanged.
 *   - Additive evolution within v1 is permitted: new optional fields, new
 *     exported types, new sanctioned adapters. These do not break consumers.
 *   - Internal kernel modules (`@kernel/<module>`) may refactor freely; the v1
 *     barrel is the stable facade that absorbs refactors so consumers do not.
 *
 * Why this matters: operating systems do not evolve by constantly changing
 * core interfaces. Freezing the API surface is what lets protocol developers
 * build against the kernel without churning on every internal refactor.
 */
export * as v1 from "./v1";
