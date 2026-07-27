/**
 * @kernel/api/v1 — PROJECTIONS public surface (FROZEN).
 *
 * The CQRS read side: pure projection definitions + the engine that rebuilds
 * read models from events.
 */
export type {
  ProjectionDefinition,
  ProjectionApplyContext,
  ProjectionStore,
  ProjectionEngine,
  ProjectionRebuilder,
  ProjectionRebuildResult,
  ReadModel,
  ProjectionQuery,
} from "@kernel/projections";

export {
  applyEvent,
  createProjectionRebuilder,
  InMemoryProjectionStore,
  InMemoryProjectionEngine,
} from "@kernel/projections";

export type { InMemoryProjectionEngineDeps } from "@kernel/projections";
