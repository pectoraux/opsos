/**
 * @kernel/projections/infrastructure — barrel.
 *
 * Reference in-memory adapters for the projections module: the Map-based
 * `InMemoryProjectionStore` and the `InMemoryProjectionEngine`. Suitable for
 * kernel self-test, the read-only inspector, and tests. NOT for production
 * persistence (no durability, no checkpointing, no DLQ).
 *
 * The rebuilder is constructed via the `createProjectionRebuilder` factory in
 * the application layer — it composes a `ProjectionStore` + a definitions
 * provider (typically `engine.list()`), so no separate in-memory rebuilder
 * adapter is needed.
 */
export { InMemoryProjectionStore } from "./in-memory-projection-store";
export {
  InMemoryProjectionEngine,
  type InMemoryProjectionEngineDeps,
} from "./in-memory-projection-engine";
