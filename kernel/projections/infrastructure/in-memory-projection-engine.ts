/**
 * @kernel/projections/infrastructure/in-memory-projection-engine — reference
 * ProjectionEngine.
 *
 * Holds a `Map` of registered `ProjectionDefinition`s (insertion order
 * preserved, so iteration is deterministic). `handle(event, ctx)` iterates
 * definitions whose `sourceEventTypes` includes `event.eventType`, derives the
 * key (default `"all"`), loads the current state from the injected
 * `ProjectionStore` (or `initialState`), applies via the PURE `applyEvent`,
 * and puts the updated read model back.
 *
 * `start(eventStore)` wires the engine to the store's live stream via
 * `eventStore.subscribe`. Each live event is forwarded to `handle` with a
 * per-event `ProjectionApplyContext` derived from the event's metadata
 * (correlationId, tenantId). Per-event errors from a projection's `apply` are
 * contained so a single faulty projection cannot kill the live subscription.
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production (no parallelism control, no checkpointing, no DLQ, no retries).
 *
 * Determinism: no `Date.now()` / `Math.random()`. `ReadModel.updatedAt` is
 * `event.timestamp` (clock-sourced at emit time); `lastEventVersion` is
 * `event.version` (per-stream).
 */

import { asId } from "@kernel/shared-kernel";
import type { ProjectionId, TenantId } from "@kernel/shared-kernel";
import type {
  EventEnvelope,
  EventStore,
  Subscription,
} from "@kernel/events";
import type {
  ProjectionDefinition,
  ProjectionApplyContext,
} from "../domain/projection-definition";
import type { ProjectionEngine } from "../domain/projection-engine";
import type { ProjectionStore, ReadModel } from "../domain/projection-store";
import { applyEvent } from "../application/project-event";

/** The default singleton key used when a definition omits `keyFor`. */
const ALL_KEY = "all";

/** Constructor deps for `InMemoryProjectionEngine`. */
export interface InMemoryProjectionEngineDeps {
  /** Where read models are materialised. */
  readonly store: ProjectionStore;
  /**
   * Default context used by `start` as a fallback when an event's metadata
   * lacks correlation/tenant ids. Callers that invoke `handle` directly pass
   * their own context.
   */
  readonly defaultContext?: ProjectionApplyContext;
}

export class InMemoryProjectionEngine implements ProjectionEngine {
  /**
   * Registered definitions keyed by `String(id)`. Insertion order preserved so
   * `handle` and `list` are deterministic.
   */
  private readonly definitions: Map<string, ProjectionDefinition> = new Map();
  private readonly store: ProjectionStore;
  private readonly defaultContext: ProjectionApplyContext | undefined;

  constructor(deps: InMemoryProjectionEngineDeps) {
    this.store = deps.store;
    this.defaultContext = deps.defaultContext;
  }

  register<TState>(definition: ProjectionDefinition<TState>): void {
    // Widen to `ProjectionDefinition<unknown>` for uniform storage. This is a
    // safe covariant widening: methods are bivariant and `initialState` is
    // covariant under TS's interface-method rules.
    this.definitions.set(
      String(definition.id),
      definition as ProjectionDefinition
    );
  }

  unregister(projectionId: ProjectionId): void {
    this.definitions.delete(String(projectionId));
  }

  async handle(
    event: EventEnvelope,
    ctx: ProjectionApplyContext
  ): Promise<void> {
    for (const def of this.definitions.values()) {
      if (!def.sourceEventTypes.includes(event.eventType)) {
        continue;
      }
      const key = def.keyFor ? def.keyFor(event) : ALL_KEY;
      const existing = await this.store.get(def.id, key);
      const currentState = existing ? existing.state : def.initialState;
      const newState = applyEvent(def, currentState, event, ctx);
      const model: ReadModel = {
        projectionId: def.id,
        key,
        state: newState,
        lastEventVersion: event.version,
        updatedAt: event.timestamp,
      };
      await this.store.put(model);
    }
  }

  start(eventStore: EventStore): Subscription {
    const fallback: ProjectionApplyContext =
      this.defaultContext ?? { correlationId: "projections-live" };

    const subscription = eventStore.subscribe(async (event) => {
      // Derive a per-event ctx from the event's metadata. `EventMetadata`
      // always carries `correlationId` (required); `tenantId` is optional.
      const md = event.metadata;
      const perEventCtx: ProjectionApplyContext = {
        correlationId: md?.correlationId ?? fallback.correlationId,
        tenantId:
          typeof md?.tenantId === "string"
            ? (asId<"TenantId">(md.tenantId) as TenantId)
            : fallback.tenantId,
      };
      try {
        await this.handle(event, perEventCtx);
      } catch {
        // Contain per-event errors so a faulty projection can't kill the live
        // subscription. Production engines route to a DLQ + observability.
      }
    });
    return subscription;
  }

  list(): readonly ProjectionDefinition[] {
    return Array.from(this.definitions.values());
  }
}
