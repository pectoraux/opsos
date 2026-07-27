/**
 * @kernel/composition/domain — barrel.
 *
 * Re-exports every domain-layer type of the Composition & Operational Package
 * System. The domain layer is pure (no I/O, no `Date.now()`, no
 * `Math.random()`); only `@kernel/shared-kernel`, `@kernel/protocol-sdk`
 * (type-only), and `@kernel/domain-modeling` (type-only) are imported.
 */

// Manifest + provenance
export * from "./package-manifest";

// Dependency + compatibility declarations
export * from "./package-dependency";

// The immutable artifact + its contents + digest
export * from "./package-artifact";

// Signature value object + the four signature ports
export * from "./package-signature";

// Diagnostics
export * from "./package-diagnostics";

// The operational package alias + version pair
export * from "./operational-package";

// The composition pipeline port + input/output/stage types
export * from "./composition-pipeline";

// The package registry port
export * from "./package-registry";

// The lifecycle state machine + events
export * from "./package-lifecycle";
