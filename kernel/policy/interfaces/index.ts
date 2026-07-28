/**
 * @kernel/policy/interfaces — public surface barrel.
 *
 * Re-exports the domain, application, and infrastructure layers so consumers
 * can `import { ... } from "@kernel/policy"` and get the full contract.
 *
 * Layering (inward-only dependency direction) is preserved: infrastructure
 * depends on application/domain; application depends on domain; domain
 * depends only on `@kernel/shared-kernel` (plus type-only imports of
 * `ProvenanceRecorder` from `@kernel/observability` in the infrastructure
 * layer — erased at runtime).
 *
 * Consistent with `@kernel/events`, `@kernel/runtime`, `@kernel/identity`,
 * `@kernel/organizations`, and `@kernel/projections`, the in-memory adapters
 * are part of the public surface — they let the kernel self-bootstrap and let
 * the read-only inspector run end-to-end without external services.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
