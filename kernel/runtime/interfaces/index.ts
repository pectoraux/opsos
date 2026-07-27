/**
 * @kernel/runtime — public surface.
 *
 * The deterministic execution engine: the execution context, graph +
 * topological order, operation port/registry, runtime state, execution
 * result, executor port, the in-memory operation-registry factory, and the
 * canonical clock / random / executor implementations.
 *
 * Dependency direction: `interfaces/ → application/ → domain/` and
 * `infrastructure/ → application/ → domain/`. `domain/` depends only on
 * `@kernel/shared-kernel` (plus type-only imports of `EventInput` from
 * `@kernel/events`, `ObservabilityBundle` from `@kernel/observability`, and
 * `ConfigRegistry` from `@kernel/config` — all erased at runtime).
 */

export * from "../domain";
export * from "../application";
export * from "../infrastructure";
