/**
 * @kernel/runtime/infrastructure/fixed-runtime-clock — deterministic, frozen
 * implementation of `RuntimeClock`.
 *
 * `now()` always returns the constructor-supplied epoch-millis. `tick()`
 * returns an internal monotonic counter (0, 1, 2, …). Two `FixedRuntimeClock`
 * instances constructed with the same epoch produce identical time/tick
 * sequences — this is what makes kernel execution replayable and simulations
 * reproducible.
 *
 * Extends the shared-kernel `FixedClock` base so callers may treat it
 * polymorphically with any other fixed clock.
 */

import { FixedClock } from "@kernel/shared-kernel";
import type { ClockTime, LogicalTick } from "@kernel/shared-kernel";

export class FixedRuntimeClock extends FixedClock {
  constructor(fixedNow: ClockTime, startTick: LogicalTick = 0) {
    super(fixedNow, startTick);
  }
}
