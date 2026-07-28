/**
 * @kernel/twin-runtime/application/update-twin-state — use-case: update an
 * entity's twin current state.
 *
 * Wraps `TwinRegistry.updateState` + `HistoryStore.record`. Produces a fresh
 * snapshot capturing (state, latest-telemetry-per-metric, latest-health-score)
 * and appends it to the history journal.
 *
 * Determinism rule: identical inputs + identical ports → identical outputs.
 */

import type { UnknownRecord } from "@kernel/shared-kernel";
import type {
  TwinRegistry,
  HistoryStore,
  TelemetryStream,
  HealthMonitor,
  TwinState,
  TwinSnapshot,
} from "../domain";

/** The input to `UpdateTwinState.execute`. Pure data. */
export interface UpdateTwinStateInput {
  readonly entityId: string;
  /** New modeled state — REPLACES the twin's current `currentState` field. */
  readonly state: UnknownRecord;
  /** Clock-sourced epoch-millis — used as `updatedAt` and snapshot timestamp. */
  readonly now: number;
}

/** The result of `UpdateTwinState.execute`. */
export interface UpdateTwinStateResult {
  readonly twin: TwinState;
  readonly snapshot: TwinSnapshot;
}

/** The use-case PORT. Returns `undefined` if no twin is registered for the entity. */
export interface UpdateTwinState {
  execute(input: UpdateTwinStateInput): UpdateTwinStateResult | undefined;
}

/**
 * Default implementation. Orchestrates the registry + history + telemetry +
 * health ports.
 */
export class UpdateTwinStateUseCase implements UpdateTwinState {
  constructor(
    private readonly registry: TwinRegistry,
    private readonly history: HistoryStore,
    private readonly telemetry: TelemetryStream,
    private readonly health: HealthMonitor,
  ) {}

  execute(input: UpdateTwinStateInput): UpdateTwinStateResult | undefined {
    const twin = this.registry.updateState(input.entityId, input.state, input.now);
    if (!twin) return undefined;

    // Build the snapshot — latest reading per metric + latest health score.
    const metrics = this.telemetry.getMetrics(input.entityId);
    const telemetryMap: Record<string, number> = {};
    for (const metric of metrics) {
      const latest = this.telemetry.getLatest(input.entityId, metric);
      if (latest) telemetryMap[metric] = latest.value;
    }
    const health = this.health.getHealth(input.entityId);
    const snapshot: TwinSnapshot = {
      entityId: input.entityId,
      state: input.state,
      telemetry: telemetryMap,
      healthScore: health?.healthScore ?? 0,
      timestamp: input.now,
    };
    this.history.record(input.entityId, snapshot);
    return { twin, snapshot };
  }
}
