/**
 * @kernel/observability/domain/bundle — the bundle carried by ExecutionContext.
 */

import type { Tracer, Meter, Logger, AuditSink, ProvenanceRecorder } from "./ports";

export interface ObservabilityBundle {
  readonly tracer: Tracer;
  readonly meter: Meter;
  readonly logger: Logger;
  readonly audit: AuditSink;
  readonly provenance: ProvenanceRecorder;
}
