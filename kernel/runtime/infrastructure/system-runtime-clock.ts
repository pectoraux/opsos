/**
 * @kernel/runtime/infrastructure/system-runtime-clock — the wall-clock
 * implementation of `RuntimeClock`.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ DETERMINISM BOUNDARY: `Date.now()` is allowed ONLY in this file.          │
 * │ Every other file in the kernel MUST source time from `ExecutionContext.clock`. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `now()` returns the real wall-clock epoch-millis. `tick()` returns a
 * process-local monotonic logical counter advanced only by the runtime — it is
 * NOT wall-clock-derived and is safe to use for ordering within an execution.
 *
 * This clock is NON-deterministic by design (it reflects real time). Use
 * `FixedRuntimeClock` for deterministic replay, tests, and simulation.
 */

import type { RuntimeClock, ClockTime, LogicalTick } from "@kernel/shared-kernel";

export class SystemRuntimeClock implements RuntimeClock {
  private _tick: LogicalTick = 0;

  /** Real wall-clock epoch-millis. The ONLY `Date.now()` call site in the kernel. */
  now(): ClockTime {
    // DETERMINISM BOUNDARY: Date.now() is allowed ONLY in this file.
    return Date.now();
  }

  /** Monotonic logical tick, advanced only here. Never goes backwards. */
  tick(): LogicalTick {
    return this._tick++;
  }
}
