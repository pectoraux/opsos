/**
 * @kernel/observability/application — observability composition use-cases.
 *
 * `createObservabilityBundle` composes individual ports into a bundle.
 */

import type {
  Tracer,
  Meter,
  Logger,
  AuditSink,
  ProvenanceRecorder,
  ObservabilityBundle,
} from "../domain";

export interface ObservabilityBundleParts {
  readonly tracer: Tracer;
  readonly meter: Meter;
  readonly logger: Logger;
  readonly audit: AuditSink;
  readonly provenance: ProvenanceRecorder;
}

export function createObservabilityBundle(parts: ObservabilityBundleParts): ObservabilityBundle {
  return parts;
}
