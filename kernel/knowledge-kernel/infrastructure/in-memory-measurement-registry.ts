/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-measurement-registry — the
 * in-memory `MeasurementRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<MeasurementId, Measurement>` — canonical measurement records
 *   - `Map<string, Set<MeasurementId>>` — metric → measurement ids
 *
 * No `Date.now()`, no `Math.random()`. List methods return measurements
 * sorted by id lexicographic ASC.
 */

import type { MeasurementId } from "@kernel/shared-kernel";
import type { Measurement } from "@kernel/shared-kernel";
import type { MeasurementRegistry } from "../domain";

export class InMemoryMeasurementRegistry implements MeasurementRegistry {
  private readonly measurements = new Map<MeasurementId, Measurement>();
  private readonly byMetric = new Map<string, Set<MeasurementId>>();

  register(measurement: Measurement): void {
    const prev = this.measurements.get(measurement.id);
    if (prev && prev.metric !== measurement.metric) {
      const oldSet = this.byMetric.get(prev.metric);
      if (oldSet) oldSet.delete(prev.id);
    }
    this.measurements.set(measurement.id, measurement);
    let set = this.byMetric.get(measurement.metric);
    if (!set) {
      set = new Set();
      this.byMetric.set(measurement.metric, set);
    }
    set.add(measurement.id);
  }

  get(id: MeasurementId): Measurement | undefined {
    return this.measurements.get(id);
  }

  list(): readonly Measurement[] {
    const out = Array.from(this.measurements.values());
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByMetric(metric: string): readonly Measurement[] {
    const set = this.byMetric.get(metric);
    if (!set) return [];
    const out: Measurement[] = [];
    for (const id of set) {
      const m = this.measurements.get(id);
      if (m) out.push(m);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }
}
