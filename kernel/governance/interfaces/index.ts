/**
 * @kernel/governance/interfaces — public surface.
 *
 * The platform's equivalent of Kubernetes API versioning, Stripe API
 * evolution, or Linux ABI stability. Governance NEVER changes operational
 * behaviour. Governance defines HOW the platform evolves. All future
 * artifacts participate automatically.
 *
 * Re-exports the domain, application, and infrastructure layers. Callers
 * should import from `@kernel/governance` (the root entry, which re-exports
 * this barrel).
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
