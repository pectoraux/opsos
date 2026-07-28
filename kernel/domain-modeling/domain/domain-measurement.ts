/**
 * @kernel/domain-modeling/domain/domain-measurement —
 * `DomainMeasurementDefinition`.
 *
 * A measurement definition is the typed contract for a quantitative attribute
 * on an EntityType. It reuses the knowledge-layer `Measurement` primitive's
 * shape (metric, unit, min, max, precision, schemaRef) but adds domain
 * context: it lives on a domain definition (not on a knowledge item) and is
 * referenced from `AttributeDefinition.measurementMetric`.
 *
 * The kernel never learns what "surface area in m²" or "blood pressure in
 * mmHg" means. A domain definition DECLARES these via
 * `DomainMeasurementDefinition`s; the compiler validates measurement-typed
 * attribute values against them.
 *
 *   `metric`     — the canonical metric name (unique within a domain). This
 *                  is the key `AttributeDefinition.measurementMetric`
 *                  references.
 *   `unit`       — the canonical unit (e.g. "m²", "mmHg", "count").
 *   `valueType`  — the JS-level value type ("number" | "string" | "boolean"
 *                  | "object"). Most measurements are `number`, but some are
 *                  categorical ("object") or text ("string").
 *   `min`        — optional lower bound (numeric only).
 *   `max`        — optional upper bound (numeric only).
 *   `precision`  — optional number of decimal places (numeric only).
 *   `schemaRef`  — optional reference to a JSON Schema for the value shape
 *                  (e.g. for compound measurements like a 3-vector).
 *
 * Determinism: pure data. No `Date.now()`, no `Math.random()`.
 */

/**
 * The JS-level value type a measurement can carry. Most measurements are
 * `number`; some are categorical (`string` / `object`) or boolean flags.
 */
export type MeasurementValueType =
  | "number"
  | "string"
  | "boolean"
  | "object";

/**
 * The definition of a measurement kind within a domain.
 *
 * Identified by `metric` (unique within a domain). Referenced from
 * `AttributeDefinition.measurementMetric`.
 */
export interface DomainMeasurementDefinition {
  readonly metric: string;
  readonly unit: string;
  readonly valueType: MeasurementValueType;
  readonly min?: number;
  readonly max?: number;
  readonly precision?: number;
  readonly schemaRef?: string;
  readonly description?: string;
}
