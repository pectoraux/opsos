/**
 * @kernel/projections/interfaces — public surface barrel.
 *
 * Re-exports the domain, application, and infrastructure layers so consumers
 * can `import { ... } from "@kernel/projections"` and get the full contract.
 *
 * Layering (inward-only dependency direction) is preserved: infrastructure
 * depends on application/domain; application depends on domain; domain depends
 * only on `@kernel/shared-kernel` and `@kernel/events` (type-only).
 *
 * Consistent with `@kernel/events`, `@kernel/runtime`, and `@kernel/identity`,
 * the in-memory adapters are part of the public surface — they let the kernel
 * self-bootstrap and let the read-only inspector run end-to-end without
 * external services.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
