/**
 * @kernel/projections/application/rebuild-projection — the rebuild use-case.
 *
 * A factory that produces a `ProjectionRebuilder` by injecting a
 * `ProjectionStore` and a source of `ProjectionDefinition`s. The orchestrator:
 *   1. Clears the projection's read models in the store (`store.clear`).
 *   2. Iterates `eventStore.readAll()`; for each event that matches a
 *      definition's `sourceEventTypes`, derives the key (default `"all"`),
 *      loads the current state (or `initialState`), applies via the PURE
 *      `applyEvent`, and puts the updated read model back.
 *
 * Determinism: no `Date.now()` / `Math.random()` anywhere. The `updatedAt`
 * field of each written `ReadModel` is sourced from `event.timestamp`
 * (clock-sourced at event creation). `lastEventVersion` is `event.version`
 * (per-stream, from the envelope).
 *
 * The rebuilder is the application-layer implementation of the
 * `ProjectionRebuilder` domain port. Infrastructure need only provide the
 * `ProjectionStore` and a definitions provider (typically `engine.list()`).
 */

import type { EventStore } from "@kernel/events";
import type { ProjectionId } from "@kernel/shared-kernel";
import type { ProjectionStore, ReadModel } from "../domain/projection-store";
import type {
  ProjectionDefinition,
  ProjectionApplyContext,
} from "../domain/projection-definition";
import type {
  ProjectionRebuilder,
  ProjectionRebuildResult,
} from "../domain/projection-rebuilder";
import { applyEvent } from "./project-event";

/** Dependencies for the rebuilder. */
export interface ProjectionRebuilderDeps {
  /** Where read models are materialised. */
  readonly store: ProjectionStore;
  /**
   * Source of registered projection definitions. Typically `() => engine.list()`.
   * The rebuilder does not own registration — it consumes whatever is currently
   * registered.
   */
  readonly definitions: () => readonly ProjectionDefinition[];
}

/** The default singleton key used when a definition omits `keyFor`. */
const ALL_KEY = "all";

/**
 * Create a `ProjectionRebuilder` backed by the injected store + definitions.
 *
 * The rebuilder holds no mutable state of its own — it is safe to call
 * concurrently for different projection ids (the store enforces its own
 * consistency). For the same projection id, concurrent rebuilds are not
 * recommended (the second would clear the first's in-flight results).
 */
export function createProjectionRebuilder(
  deps: ProjectionRebuilderDeps
): ProjectionRebuilder {
  const { store, definitions } = deps;

  /**
   * Rebuild a single projection by replaying all events. Clears first.
   * Returns the number of events that matched the projection's source types.
   * Errors from `def.apply` propagate to the caller — a rebuild must either
   * complete consistently or fail loudly.
   */
  async function rebuildOne(
    def: ProjectionDefinition,
    eventStore: EventStore,
    ctx: ProjectionApplyContext
  ): Promise<number> {
    await store.clear(def.id);
    let processed = 0;
    for await (const event of eventStore.readAll()) {
      // Cheap pre-filter: skip non-matching event types before touching the
      // store. `applyEvent` re-checks, but this avoids the key-derivation +
      // store round-trip for irrelevant events.
      if (!def.sourceEventTypes.includes(event.eventType)) {
        continue;
      }
      processed += 1;
      const key = def.keyFor ? def.keyFor(event) : ALL_KEY;
      const existing = await store.get(def.id, key);
      const currentState = existing ? existing.state : def.initialState;
      const newState = applyEvent(def, currentState, event, ctx);
      const model: ReadModel = {
        projectionId: def.id,
        key,
        state: newState,
        lastEventVersion: event.version,
        updatedAt: event.timestamp,
      };
      await store.put(model);
    }
    return processed;
  }

  return {
    async rebuild(
      projectionId: ProjectionId,
      eventStore: EventStore,
      ctx: ProjectionApplyContext
    ): Promise<ProjectionRebuildResult> {
      const def = definitions().find((d) => d.id === projectionId);
      if (!def) {
        // No matching definition registered — nothing to rebuild.
        return { processed: 0 };
      }
      const processed = await rebuildOne(def, eventStore, ctx);
      return { processed };
    },
    async rebuildAll(
      eventStore: EventStore,
      ctx: ProjectionApplyContext
    ): Promise<ProjectionRebuildResult> {
      let total = 0;
      for (const def of definitions()) {
        total += await rebuildOne(def, eventStore, ctx);
      }
      return { processed: total };
    },
  };
}
