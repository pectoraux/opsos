/**
 * @kernel/resource-kernel/infrastructure/in-memory-availability-engine — the
 * in-memory `AvailabilityEngine` implementation.
 *
 * Pure data structure: a `Map<ResourceId, { state, updatedAt }>`. No
 * `Date.now()`, no `Math.random()`. All time flows through the `now`
 * argument.
 *
 * State machine: see `domain/availability-engine.ts` for the legal-transition
 * table. `setState` bypasses the table (bootstrap / repair);
 * `transition` enforces it.
 */

import { IllegalStateError } from "@kernel/shared-kernel";
import type { ResourceId } from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";
import type {
  AvailabilityEngine,
  AvailabilityState,
} from "../domain";
import {
  canTransitionAvailability,
  isBlocked,
} from "../domain";

interface Entry {
  state: AvailabilityState;
  updatedAt: number;
}

export class InMemoryAvailabilityEngine implements AvailabilityEngine {
  private readonly states = new Map<ResourceId, Entry>();

  getState(resourceId: ResourceId): AvailabilityState {
    const entry = this.states.get(resourceId);
    return entry ? entry.state : "idle";
  }

  setState(
    resourceId: ResourceId,
    state: AvailabilityState,
    now: number
  ): void {
    this.states.set(resourceId, { state, updatedAt: now });
  }

  isAvailable(
    resourceId: ResourceId,
    _window: TemporalWindow,
    _now: number
  ): boolean {
    const state = this.getState(resourceId);
    return !isBlocked(state);
  }

  transition(
    resourceId: ResourceId,
    to: AvailabilityState,
    now: number
  ): ReturnType<AvailabilityEngine["transition"]> {
    const current = this.getState(resourceId);
    if (!canTransitionAvailability(current, to)) {
      return {
        ok: false,
        error: new IllegalStateError(
          `Resource '${resourceId}' cannot transition from '${current}' to '${to}'`
        ),
      };
    }
    this.setState(resourceId, to, now);
    return { ok: true, value: undefined };
  }
}
