/**
 * @kernel/identity/interfaces — public surface barrel.
 *
 * Re-exports the domain, application, and infrastructure layers so consumers
 * can `import { ... } from "@kernel/identity"` and get the full contract.
 *
 * Layering (inward-only dependency direction) is preserved: infrastructure
 * depends on application/domain; application depends on domain; domain depends
 * only on `@kernel/shared-kernel` (and the event-sourcing abstractions from
 * `@kernel/events`).
 *
 * Consistent with `@kernel/events` and `@kernel/runtime`, the in-memory
 * adapters are part of the public surface — they let the kernel self-bootstrap
 * and let the read-only inspector run end-to-end without external services.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
