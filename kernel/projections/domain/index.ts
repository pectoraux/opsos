/**
 * @kernel/projections/domain — barrel.
 *
 * The pure domain layer of the projections module: `ProjectionDefinition`,
 * `ProjectionStore` / `ReadModel` / `ProjectionQuery`, `ProjectionEngine`, and
 * `ProjectionRebuilder` ports. Depends only on `@kernel/shared-kernel` and
 * `@kernel/events` (type-only).
 *
 * No I/O, no adapters, no `Date.now()` / `Math.random()`.
 *
 * Public surface (re-exported through `@kernel/projections`):
 *   - `ProjectionDefinition`, `ProjectionApplyContext`
 *   - `ReadModel`, `ProjectionQuery`, `ProjectionStore` (port)
 *   - `ProjectionEngine` (port)
 *   - `ProjectionRebuilder` (port), `ProjectionRebuildResult`
 */
export * from "./projection-definition";
export * from "./projection-store";
export * from "./projection-engine";
export * from "./projection-rebuilder";
