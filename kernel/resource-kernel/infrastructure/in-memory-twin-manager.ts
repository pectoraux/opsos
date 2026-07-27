/**
 * @kernel/resource-kernel/infrastructure/in-memory-twin-manager — the
 * in-memory `TwinManager` implementation.
 *
 * Pure data structures:
 *   - `Map<ResourceId, Twin>` — the current twin per resource
 *   - `Map<ResourceId, TwinState[]>` — the history journal per resource
 *   - `Map<ResourceId, Telemetry[]>` — the telemetry journal per resource
 *   - `Map<ResourceId, TwinPrediction[]>` — protocol-supplied predictions
 *
 * No `Date.now()`, no `Math.random()`. All time flows through the `now`
 * argument. The lazily-initialised twin's `TwinId` is derived deterministically
 * from `resourceId` via `computeTwinId`.
 */

import type { ResourceId, TwinId } from "@kernel/shared-kernel";
import type {
  Twin,
  Telemetry,
  UnknownRecord,
} from "@kernel/shared-kernel";
import type {
  TwinManager,
  TwinState,
  TwinPrediction,
} from "../domain";
import { computeTwinId } from "../domain";

const DEFAULT_MODEL_TYPE = "resource";
const DEFAULT_FIDELITY = 1.0;

export class InMemoryTwinManager implements TwinManager {
  private readonly twins = new Map<ResourceId, Twin>();
  private readonly history = new Map<ResourceId, TwinState[]>();
  private readonly telemetry = new Map<ResourceId, Telemetry[]>();
  private readonly predictions = new Map<ResourceId, TwinPrediction[]>();

  /**
   * Seeds the twin for a resource from a `ResourceRecord.twin` (or any
   * caller-supplied `Twin`). Called by the InMemoryResourceKernel bundle when
   * a resource is registered.
   */
  initTwin(resourceId: ResourceId, twin: Twin): void {
    this.twins.set(resourceId, twin);
    // Seed the history journal with the initial state.
    const snapshot: TwinState = {
      resourceId,
      state: twin.state as UnknownRecord,
      updatedAt: twin.updatedAt,
      telemetry: [],
    };
    this.history.set(resourceId, [snapshot]);
  }

  /**
   * Sets / replaces the predictions for a resource. Protocols call this to
   * publish forward projections.
   */
  setPredictions(resourceId: ResourceId, predictions: readonly TwinPrediction[]): void {
    this.predictions.set(resourceId, [...predictions]);
  }

  getTwin(resourceId: ResourceId): Twin | undefined {
    return this.twins.get(resourceId);
  }

  updateState(
    resourceId: ResourceId,
    state: UnknownRecord,
    now: number
  ): void {
    const existing = this.twins.get(resourceId);
    const id: TwinId = existing ? existing.id : computeTwinId(resourceId);
    const resourceType = existing?.resourceType;
    const fidelity = existing?.fidelity ?? DEFAULT_FIDELITY;
    const assumptions = existing?.assumptions ?? [];
    const validUntil = existing?.validUntil;
    const updated: Twin = {
      id,
      resourceId,
      resourceType,
      modelType: existing?.modelType ?? DEFAULT_MODEL_TYPE,
      state,
      updatedAt: now,
      fidelity,
      assumptions,
      validUntil,
    };
    this.twins.set(resourceId, updated);

    // Append a snapshot to the history journal (carries current telemetry).
    const tel = this.telemetry.get(resourceId) ?? [];
    const snapshot: TwinState = {
      resourceId,
      state,
      updatedAt: now,
      telemetry: tel.slice(),
    };
    const hist = this.history.get(resourceId) ?? [];
    hist.push(snapshot);
    this.history.set(resourceId, hist);
  }

  addTelemetry(resourceId: ResourceId, reading: Telemetry): void {
    if (reading.resourceId !== resourceId) return; // defensive
    const list = this.telemetry.get(resourceId) ?? [];
    list.push(reading);
    // Keep the journal sorted by timestamp (deterministic).
    list.sort((a, b) => a.timestamp - b.timestamp);
    this.telemetry.set(resourceId, list);
  }

  getHistory(
    resourceId: ResourceId,
    from: number,
    to: number
  ): readonly TwinState[] {
    const hist = this.history.get(resourceId);
    if (!hist) return [];
    return hist
      .filter((s) => s.updatedAt >= from && s.updatedAt <= to)
      .slice()
      .sort((a, b) => a.updatedAt - b.updatedAt);
  }

  getPredictions(resourceId: ResourceId): readonly TwinPrediction[] {
    return this.predictions.get(resourceId) ?? [];
  }

  /**
   * Returns the full telemetry journal for a resource within `[from, to]`.
   * Convenience accessor (not on the bare interface).
   */
  getTelemetry(
    resourceId: ResourceId,
    from: number,
    to: number
  ): readonly Telemetry[] {
    const tel = this.telemetry.get(resourceId);
    if (!tel) return [];
    return tel
      .filter((t) => t.timestamp >= from && t.timestamp <= to)
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}
