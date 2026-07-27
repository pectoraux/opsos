/**
 * @kernel/resource-kernel/application/update-twin — the use-case that updates a
 * resource's digital-twin state and (optionally) appends a telemetry reading.
 *
 * Wraps `TwinManager.updateState` + `TwinManager.addTelemetry` in a single
 * atomic operation with a typed result. This is the typical write path for
 * observation-driven twin updates: a sensor emits a reading, the application
 * updates both the twin's modeled state and the telemetry journal in one
 * call.
 *
 * Determinism rule: identical inputs + identical engine → identical outputs.
 */

import type { ResourceId } from "@kernel/shared-kernel";
import type { UnknownRecord, Telemetry } from "@kernel/shared-kernel";
import type { TwinManager } from "../domain";

/**
 * The input to `UpdateTwin.execute`. Pure data.
 */
export interface UpdateTwinInput {
  readonly resourceId: ResourceId;
  /** New modeled state — REPLACES the twin's current `state` field. */
  readonly state: UnknownRecord;
  /** Optional telemetry reading to append to the journal. */
  readonly telemetry?: Telemetry;
  /** Clock-sourced epoch-millis — used as `updatedAt` for the snapshot. */
  readonly now: number;
}

/**
 * The result of `UpdateTwin.execute`.
 */
export interface UpdateTwinResult {
  /** The `updatedAt` of the new twin snapshot (= `input.now`). */
  readonly updatedAt: number;
  /** `true` iff a telemetry reading was appended. */
  readonly telemetryAdded: boolean;
  /** Number of history snapshots now held for the resource. */
  readonly historySize: number;
}

/**
 * The use-case PORT.
 */
export interface UpdateTwin {
  execute(input: UpdateTwinInput): UpdateTwinResult;
}

/**
 * Default implementation.
 */
export class UpdateTwinUseCase implements UpdateTwin {
  constructor(private readonly twins: TwinManager) {}

  execute(input: UpdateTwinInput): UpdateTwinResult {
    this.twins.updateState(input.resourceId, input.state, input.now);
    let telemetryAdded = false;
    if (input.telemetry) {
      // Defensive: only append if the reading's resourceId matches.
      if (input.telemetry.resourceId === input.resourceId) {
        this.twins.addTelemetry(input.resourceId, input.telemetry);
        telemetryAdded = true;
      }
    }
    // History window covering [0, now] — gets every snapshot up to `now`.
    const history = this.twins.getHistory(input.resourceId, 0, input.now);
    return {
      updatedAt: input.now,
      telemetryAdded,
      historySize: history.length,
    };
  }
}
