/**
 * @kernel/runtime/domain/runtime-state — the immutable state container threaded
 * through an execution.
 *
 * `RuntimeState` is a generic, domain-agnostic key/value bag with a monotonic
 * `version` counter. It is the *thread state* the executor passes from node to
 * node: each node's `outputs` are merged via `set(key, value)`, producing a NEW
 * state (immutability).
 *
 * `apply(event)` advances `version` to the event's version — used when
 * reconstructing state from a replayed event stream. It does NOT mutate `data`;
 * domain-specific event interpretation belongs to domain aggregates
 * (`EventSourcedAggregateBase`), not to this generic container.
 *
 * Both transitions return a NEW `RuntimeState`; `this` is never mutated.
 */

import type { EventEnvelope } from "@kernel/events";

export interface RuntimeState {
  /** Immutable key/value bag. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Monotonic version, advanced by `apply(event)`. */
  readonly version: number;
  /** Return a NEW state with `version` advanced to `event.version` (data unchanged). */
  apply(event: EventEnvelope): RuntimeState;
  /** Return a NEW state with `data[key] = value` (version unchanged). */
  set(key: string, value: unknown): RuntimeState;
}

/** Internal implementation — not exported; the factory is the public surface. */
class RuntimeStateImpl implements RuntimeState {
  constructor(
    readonly data: Readonly<Record<string, unknown>>,
    readonly version: number
  ) {}

  apply(event: EventEnvelope): RuntimeState {
    return new RuntimeStateImpl(this.data, event.version);
  }

  set(key: string, value: unknown): RuntimeState {
    return new RuntimeStateImpl({ ...this.data, [key]: value }, this.version);
  }
}

/**
 * Create a fresh `RuntimeState`. `initial` (if provided) is copied defensively.
 */
export function createRuntimeState(
  initial?: Readonly<Record<string, unknown>>
): RuntimeState {
  return new RuntimeStateImpl(initial ? { ...initial } : {}, 0);
}
