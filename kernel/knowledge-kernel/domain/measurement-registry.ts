/**
 * @kernel/knowledge-kernel/domain/measurement-registry — the MeasurementRegistry
 * PORT.
 *
 * A `Measurement` is a typed measurement definition — a metric (e.g.
 * "surface-area"), a unit (e.g. "m^2"), optional min/max bounds, precision,
 * and an optional schemaRef. The Measurement Registry owns the canonical
 * `Measurement` record linked back to its `KnowledgeItem` parent.
 *
 * Measurements are universal across operational industries: cleaning
 * (surface area, dwell time, concentration), medical (dose, vital sign,
 * lab value), construction (dimension, load, deflection).
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { MeasurementId } from "@kernel/shared-kernel";
import type { Measurement } from "@kernel/shared-kernel";

/**
 * The MeasurementRegistry PORT.
 */
export interface MeasurementRegistry {
  /** Registers (or replaces) a measurement record. */
  register(measurement: Measurement): void;
  /** Returns the measurement record, or `undefined` if unknown. */
  get(id: MeasurementId): Measurement | undefined;
  /** Returns all measurements, sorted by id lexicographic. */
  list(): readonly Measurement[];
  /**
   * Returns all measurements whose `metric` matches exactly
   * (case-sensitive), sorted by id lexicographic.
   */
  listByMetric(metric: string): readonly Measurement[];
}
