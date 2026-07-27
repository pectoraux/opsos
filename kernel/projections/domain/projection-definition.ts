/**
 * @kernel/projections/domain/projection-definition — ProjectionDefinition +
 * ProjectionApplyContext.
 *
 * A `ProjectionDefinition<TState>` realises the canonical `Projection` primitive
 * from `@kernel/shared-kernel`. It is a PURE recipe for deriving a read model
 * from events: given the current state and an event, return the next state.
 *
 * Projections are the read side of CQRS. Read models are NEVER mutated by query
 * code; they are rebuilt only by the engine replaying events.
 *
 * Determinism contract (enforced):
 *   - `apply` MUST be pure. It MUST NOT mutate `state`, MUST NOT call
 *     `Date.now()` / `Math.random()`, MUST NOT perform I/O.
 *   - Time comes from `event.timestamp` (clock-sourced at emit time); correlation
 *     comes from `ctx.correlationId`. The `ctx` carries no clock/random —
 *     projections are pure functions of events, not of the wall clock.
 */

import type { ProjectionId, TenantId } from "@kernel/shared-kernel";
import type { EventEnvelope } from "@kernel/events";

/**
 * Context threaded through a projection's `apply`. Pure data: correlation id +
 * optional tenant boundary. Deliberately carries NO clock/random — projections
 * derive time from the event envelope's `timestamp`, never from the wall clock,
 * so replay is byte-identical.
 */
export interface ProjectionApplyContext {
  readonly correlationId: string;
  readonly tenantId?: TenantId;
}

/**
 * A projection definition. Realises the canonical `Projection` primitive.
 *
 * `apply` is the PURE state transition: `(currentState, event, ctx) → newState`.
 * It MUST NOT mutate `currentState`; return a new state object instead. Two
 * replays of the same events through the same definition produce identical
 * state.
 *
 * `keyFor` (optional) derives a read-model key from an event — used when a
 * projection maintains per-entity read models (e.g. one per aggregate id).
 * When omitted, the engine uses the singleton key `"all"`.
 */
export interface ProjectionDefinition<TState = unknown> {
  /** Canonical projection id (branded `ProjectionId`). */
  readonly id: ProjectionId;
  /** Human-readable name. */
  readonly name: string;
  /** Event types this projection consumes. Events of other types are ignored. */
  readonly sourceEventTypes: readonly string[];
  /** Initial state for a read model that has processed no events yet. */
  readonly initialState: TState;
  /**
   * PURE: `(currentState, event, ctx) → newState`. MUST NOT mutate
   * `currentState`. MUST NOT call `Date.now()` / `Math.random()` or perform
   * any I/O. Time comes from `event.timestamp`; correlation from
   * `ctx.correlationId`.
   */
  apply(
    state: TState,
    event: EventEnvelope,
    ctx: ProjectionApplyContext
  ): TState;
  /**
   * Optional: derive a read-model key from an event. Used for keyed
   * (per-entity) read models. When omitted, the engine uses `"all"`. MUST be
   * pure and deterministic — same event → same key.
   */
  keyFor?(event: EventEnvelope): string;
}
