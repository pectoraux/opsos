/**
 * @kernel/projections/application — barrel.
 *
 * The application layer of the projections module: PURE use-cases that
 * orchestrate the domain ports. No I/O except through injected ports; no
 * `Date.now()` / `Math.random()`.
 *
 *   - `applyEvent` — the pure per-event state transition (delegates to
 *     `ProjectionDefinition.apply` with `sourceEventTypes` filtering).
 *   - `createProjectionRebuilder` — produces a `ProjectionRebuilder` by
 *     injecting a `ProjectionStore` + a definitions provider; replays
 *     `eventStore.readAll()` to rebuild read models from scratch.
 */
export * from "./project-event";
export * from "./rebuild-projection";
