/**
 * @kernel/events/domain/aggregate — generic event-sourced aggregate base.
 *
 * A lightweight, deterministic aggregate container. It holds current `state`
 * and `version`; `apply` runs the domain `reduce` function and advances the
 * version. Domain modules subclass or compose this with their own behaviour.
 */

import type { AggregateId, Version } from "@kernel/shared-kernel";
import type { EventEnvelope } from "./event-envelope";
import type { AggregateReducer, EventSourcedAggregate } from "./event-sourced-repository";

export class EventSourcedAggregateBase<TState, TEventPayload = unknown>
  implements EventSourcedAggregate<TState, TEventPayload>
{
  readonly aggregateType: string;
  readonly id: AggregateId | string;
  private _state: TState;
  private _version: Version;
  private readonly reduce: AggregateReducer<TState, TEventPayload>["reduce"];

  constructor(
    reducer: AggregateReducer<TState, TEventPayload>,
    id: AggregateId | string,
    initialState: TState,
    version: Version = 0
  ) {
    this.aggregateType = reducer.aggregateType;
    this.id = id;
    this._state = initialState;
    this._version = version;
    this.reduce = reducer.reduce;
  }

  get state(): TState {
    return this._state;
  }

  get version(): Version {
    return this._version;
  }

  apply(event: EventEnvelope<TEventPayload>): void {
    this._state = this.reduce(this._state, event);
    this._version = event.version;
  }

  static fromReducer<TState, TEventPayload>(
    reducer: AggregateReducer<TState, TEventPayload>,
    id: AggregateId | string,
    initialState: TState,
    version?: Version
  ): EventSourcedAggregateBase<TState, TEventPayload> {
    return new EventSourcedAggregateBase<TState, TEventPayload>(
      reducer,
      id,
      initialState,
      version
    );
  }
}
