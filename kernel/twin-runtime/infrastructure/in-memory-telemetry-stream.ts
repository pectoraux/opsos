/**
 * @kernel/twin-runtime/infrastructure/in-memory-telemetry-stream — the
 * in-memory `TelemetryStream` implementation.
 *
 * Pure `Map<entityId, TelemetryReading[]>`. Readings are kept sorted by
 * timestamp (deterministic). No `Date.now()`, no `Math.random()`.
 */

import type { TelemetryReading, TelemetryStream } from "../domain";

export class InMemoryTelemetryStream implements TelemetryStream {
  private readonly byEntity = new Map<string, TelemetryReading[]>();

  ingest(reading: TelemetryReading): void {
    const list = this.byEntity.get(reading.entityId) ?? [];
    list.push(reading);
    // Keep the journal sorted by timestamp (deterministic).
    list.sort((a, b) => a.timestamp - b.timestamp);
    this.byEntity.set(reading.entityId, list);
  }

  getReadings(
    entityId: string,
    metric?: string,
    from?: number,
    to?: number,
  ): readonly TelemetryReading[] {
    const list = this.byEntity.get(entityId);
    if (!list) return [];
    return list.filter(
      (r) =>
        (metric === undefined || r.metric === metric) &&
        (from === undefined || r.timestamp >= from) &&
        (to === undefined || r.timestamp <= to),
    );
  }

  getLatest(entityId: string, metric: string): TelemetryReading | undefined {
    const readings = this.getReadings(entityId, metric);
    if (readings.length === 0) return undefined;
    let latest = readings[0];
    for (const r of readings) {
      if (r.timestamp > latest.timestamp) latest = r;
    }
    return latest;
  }

  getMetrics(entityId: string): readonly string[] {
    const list = this.byEntity.get(entityId);
    if (!list) return [];
    const set = new Set<string>();
    for (const r of list) set.add(r.metric);
    return Array.from(set).sort();
  }
}
