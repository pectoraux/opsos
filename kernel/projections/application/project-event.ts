/**
 * @kernel/projections/application/project-event — the PURE `applyEvent` use-case.
 *
 * A thin wrapper around `ProjectionDefinition.apply` that:
 *   1. Checks `sourceEventTypes` membership — returns `state` unchanged if the
 *      event type is not consumed by this projection.
 *   2. Delegates to `def.apply(state, event, ctx)`.
 *
 * PURE: no I/O, no `Date.now()` / `Math.random()`, no mutation of `state`.
 * This is the sanctioned single entry point for applying an event to a
 * projection's state — both the live engine and the rebuilder use it so the
 * filtering rule is defined once.
 */

import type { EventEnvelope } from "@kernel/events";
import type {
  ProjectionDefinition,
  ProjectionApplyContext,
} from "../domain/projection-definition";

/**
 * Apply a single event to a projection's state. PURE.
 *
 * If `event.eventType` is not in `def.sourceEventTypes`, the state is returned
 * UNCHANGED (referentially identical — no copy). Otherwise `def.apply(state,
 * event, ctx)` is called and its result returned.
 *
 * The caller is responsible for loading the current state (from the
 * `ProjectionStore`) and putting the new state back. This function does not
 * touch any port — it is the pure core of the projection transition.
 */
export function applyEvent<TState>(
  def: ProjectionDefinition<TState>,
  state: TState,
  event: EventEnvelope,
  ctx: ProjectionApplyContext
): TState {
  if (!def.sourceEventTypes.includes(event.eventType)) {
    return state;
  }
  return def.apply(state, event, ctx);
}
