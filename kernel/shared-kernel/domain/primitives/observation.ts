/**
 * @kernel/shared-kernel/domain/primitives/observation — the Observation
 * canonical primitive.
 *
 * An `Observation` is an observed fact about the world: a sensor reading, a
 * reported status, an inferred state, a system telemetry point. Observations
 * are the feedback channel that closes the operational loop — they flow back
 * into decisions, planning, and twins.
 *
 * Observations are IMMUTABLE and PROVENANCED: every observation records what
 * observed it, when (from the RuntimeClock), and the events/inputs that
 * substantiate it. This is what makes the operational history auditable and
 * replayable.
 *
 * Domain-independent. No industry-specific fields.
 */

import type {
  ObservationId,
  ResourceId,
  PrincipalId,
} from "../identifiers";
import type { ProvenanceRef } from "../value-objects";

export type ObservationSource =
  | "sensor"
  | "report"
  | "inference"
  | "system";

/** What the observation is about (generic kind + id). */
export interface ObservationSubject {
  readonly kind: string;
  readonly id: string;
}

/**
 * An observed fact. The `value` is intentionally `unknown` (validated by the
 * consumer against the subject's expected schema) so the kernel stays
 * domain-independent.
 */
export interface Observation {
  readonly id: ObservationId;
  /** Epoch-millis from the RuntimeClock at observation time. */
  readonly observedAt: number;
  /** Who/what produced the observation (a resource or a principal). */
  readonly observer: ResourceId | PrincipalId;
  readonly subject: ObservationSubject;
  /** Optional metric name (e.g. "temperature", "completion_ratio"). */
  readonly metric?: string;
  /** The observed value (validated by the consumer). */
  readonly value: unknown;
  /** Caller-supplied confidence in [0, 1]. */
  readonly confidence: number;
  readonly source: ObservationSource;
  readonly provenance: ProvenanceRef;
}
