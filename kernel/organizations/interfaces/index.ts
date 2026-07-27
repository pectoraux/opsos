/**
 * @kernel/organizations/interfaces — public surface barrel.
 *
 * Re-exports the domain, application, and infrastructure layers so consumers
 * can `import { ... } from "@kernel/organizations"` and get the full contract.
 *
 * Layering (inward-only dependency direction) is preserved: infrastructure
 * depends on application/domain; application depends on domain; domain depends
 * only on `@kernel/shared-kernel` and `@kernel/events` (the event-sourcing
 * abstractions the aggregates plug into).
 *
 * Consistent with `@kernel/events`, `@kernel/runtime`, and `@kernel/identity`,
 * the in-memory adapters are part of the public surface — they let the kernel
 * self-bootstrap and let the read-only inspector run end-to-end without
 * external services.
 *
 * Identity seam: organizations references `PrincipalId` / `UserId` / `RoleId`
 * OPAQUELY (as branded strings from `@kernel/shared-kernel`). It does NOT
 * import identity's infrastructure — only the shared branded-id types. The
 * dependency graph permits importing identity *interface only*; organizations
 * deliberately keeps the seam minimal (zero runtime imports from identity).
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
