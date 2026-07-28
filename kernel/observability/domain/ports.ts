/**
 * @kernel/observability/domain — tracing/metrics/logging/audit/provenance ports.
 *
 * Everything executed in the kernel is traceable. `ExecutionContext.observability`
 * carries an `ObservabilityBundle` of these ports. A `NoopObservability` is
 * provided for headless/deterministic runs.
 */

import type { UnknownRecord } from "@kernel/shared-kernel";

// ── Tracing ─────────────────────────────────────────────────────────────────

export interface SpanContext {
  readonly spanId: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
}

export interface Span {
  readonly name: string;
  readonly context: SpanContext;
  readonly startedAt: number;
  end(at?: number, attributes?: UnknownRecord): void;
  setAttribute(key: string, value: unknown): void;
  recordError(error: unknown): void;
}

export interface Tracer {
  startSpan(name: string, parent?: SpanContext, attributes?: UnknownRecord): Span;
  currentSpan(): Span | null;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export type MetricKind = "counter" | "gauge" | "histogram";

export interface MetricSeries {
  readonly name: string;
  readonly kind: MetricKind;
  inc(by?: number, attributes?: UnknownRecord): void;
  set(value: number, attributes?: UnknownRecord): void;
  observe(value: number, attributes?: UnknownRecord): void;
}

export interface Meter {
  counter(name: string, description?: string): MetricSeries;
  gauge(name: string, description?: string): MetricSeries;
  histogram(name: string, description?: string): MetricSeries;
}

// ── Logging ─────────────────────────────────────────────────────────────────

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly attributes: UnknownRecord;
  readonly span?: SpanContext;
}

export interface Logger {
  log(record: LogRecord): void;
  trace(message: string, attributes?: UnknownRecord): void;
  debug(message: string, attributes?: UnknownRecord): void;
  info(message: string, attributes?: UnknownRecord): void;
  warn(message: string, attributes?: UnknownRecord): void;
  error(message: string, attributes?: UnknownRecord): void;
  fatal(message: string, attributes?: UnknownRecord): void;
  child(bindings: UnknownRecord): Logger;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditEvent {
  readonly id: string;
  readonly timestamp: number;
  readonly actorPrincipalId?: string;
  readonly tenantId?: string;
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly before?: UnknownRecord;
  readonly after?: UnknownRecord;
  readonly correlationId?: string;
  readonly reason?: string;
}

export interface AuditSink {
  record(event: AuditEvent): void | Promise<void>;
}

// ── Decision provenance ─────────────────────────────────────────────────────

export interface DecisionProvenance {
  readonly decisionId: string;
  readonly decisionType: string;
  readonly inputs: UnknownRecord;
  readonly sourceEventIds: readonly string[];
  readonly inputHash?: string;
  readonly recordedAt: number;
}

export interface ProvenanceRecorder {
  recordDecision(
    decisionId: string,
    decisionType: string,
    inputs: UnknownRecord,
    sourceEventIds: readonly string[]
  ): void;
}
