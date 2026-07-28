/**
 * @kernel/twin-runtime/domain/twin-telemetry — the TwinTelemetry aggregate +
 * TelemetryReading + TelemetryStream PORT.
 *
 * Telemetry is the live sensor stream feeding a twin. Each `TelemetryReading`
 * is a single (metric, value) observation at a point in time. The
 * `TelemetryStream` port ingests readings and queries them by metric / time
 * window.
 *
 * Determinism rule: pure types — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument supplied by the caller.
 */

/** A reading-quality score in [0, 1]. */
export type TelemetryQuality = number;

/**
 * A single telemetry reading from an entity's sensor stream. `id` is the
 * caller's deterministic identifier for the reading (e.g. a derived UUID).
 */
export interface TelemetryReading {
  readonly id: string;
  readonly entityId: string;
  readonly metric: string;
  readonly value: number;
  readonly unit?: string;
  /** Epoch-millis from the RuntimeClock. */
  readonly timestamp: number;
  /** Caller-supplied confidence in the reading, in [0, 1]. */
  readonly quality: TelemetryQuality;
}

/**
 * The telemetry journal for a single entity. Pure data — the
 * TelemetryStream is the port that produces and persists these.
 */
export interface TwinTelemetry {
  readonly entityId: string;
  readonly readings: readonly TelemetryReading[];
}

/**
 * The TelemetryStream PORT. Implementations MUST be pure functions of their
 * inputs. `getReadings` returns readings whose `timestamp` falls in
 * `[from, to]` (inclusive both ends), ordered ascending by timestamp.
 */
export interface TelemetryStream {
  ingest(reading: TelemetryReading): void;
  getReadings(
    entityId: string,
    metric?: string,
    from?: number,
    to?: number,
  ): readonly TelemetryReading[];
  getLatest(entityId: string, metric: string): TelemetryReading | undefined;
  getMetrics(entityId: string): readonly string[];
}
