/**
 * @kernel/shared-kernel — RuntimeClock port.
 *
 * THE source of time inside the deterministic core. `Date.now()` is forbidden
 * in `domain/` and `application/`; every timestamp flows through the
 * `RuntimeClock` instance carried by `ExecutionContext`.
 *
 * Concrete implementations live in `kernel/runtime/infrastructure`
 * (`SystemRuntimeClock`, `FixedRuntimeClock`).
 */

import type { ClockTime, LogicalTick } from "../versioning";

export interface RuntimeClock {
  /** Current epoch-millis time. Deterministic if the clock is fixed. */
  now(): ClockTime;
  /**
   * Monotonic logical tick, advanced only by the runtime. Useful for ordering
   * events emitted within a single command without relying on wall-clock
   * resolution.
   */
  tick(): LogicalTick;
}

/**
 * A clock frozen at a fixed instant. The default for deterministic execution,
 * replay, and simulation.
 */
export abstract class FixedClock implements RuntimeClock {
  protected constructor(
    protected readonly fixedNow: ClockTime,
    protected nextTick: LogicalTick = 0
  ) {}
  now(): ClockTime {
    return this.fixedNow;
  }
  tick(): LogicalTick {
    return this.nextTick++;
  }
}
