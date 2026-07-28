/**
 * @kernel/shared-kernel/domain — bedrock barrel.
 */

// Identifiers
export * from "./identifiers";

// Result / Option
export * from "./result";

// Errors
export * from "./errors";

// Versioning & time
export * from "./versioning";

// Temporal value objects
export * from "./temporal";

// Shared value objects
export * from "./value-objects";

// Ports (RuntimeClock, RandomSource)
export type { RuntimeClock } from "./ports/runtime-clock";
export { FixedClock } from "./ports/runtime-clock";
export type { RandomSource } from "./ports/random-source";
export { mulberry32, hashSeed } from "./ports/random-source";

// Canonical primitives
export * from "./primitives";
