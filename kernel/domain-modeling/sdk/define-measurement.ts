/**
 * @kernel/domain-modeling/sdk/define-measurement — `defineMeasurement()` DSL.
 *
 * Strongly-typed builder for a `DomainMeasurementDefinition`.
 */

import type { DomainMeasurementDefinition } from "../domain/domain-measurement";
import type { MeasurementValueType } from "../domain/domain-measurement";

/** Input to `defineMeasurement()`. */
export interface DefineMeasurementInput {
  readonly metric: string;
  readonly unit: string;
  readonly valueType: MeasurementValueType;
  readonly min?: number;
  readonly max?: number;
  readonly precision?: number;
  readonly schemaRef?: string;
  readonly description?: string;
}

/** Build a `DomainMeasurementDefinition`. */
export function defineMeasurement(
  input: DefineMeasurementInput
): DomainMeasurementDefinition {
  return {
    metric: input.metric,
    unit: input.unit,
    valueType: input.valueType,
    min: input.min,
    max: input.max,
    precision: input.precision,
    schemaRef: input.schemaRef,
    description: input.description,
  };
}
