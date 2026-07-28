/**
 * @kernel/observability/infrastructure — concrete observability adapters.
 *
 * - `NoopObservability`: drops everything — for deterministic/headless runs.
 * - `ConsoleLogger`: structured logs to console.
 * - `InMemoryMeter`: records metric points in memory (for the inspector).
 * - `InMemoryAuditSink`: records audit events in memory.
 * - `InMemoryTracer`: records spans in memory.
 * - `InMemoryProvenanceRecorder`: records decision provenance in memory.
 */

import type {
  Tracer,
  Span,
  SpanContext,
  Meter,
  MetricSeries,
  Logger,
  LogRecord,
  LogLevel,
  AuditSink,
  AuditEvent,
  ProvenanceRecorder,
  DecisionProvenance,
  ObservabilityBundle,
} from "../domain";
import type { UnknownRecord } from "@kernel/shared-kernel";

// ── Noop ────────────────────────────────────────────────────────────────────

class NoopSpan implements Span {
  readonly startedAt = 0;
  constructor(readonly name: string, readonly context: SpanContext) {}
  end(): void {}
  setAttribute(): void {}
  recordError(): void {}
}

export class NoopTracer implements Tracer {
  startSpan(name: string, parent?: SpanContext): Span {
    return new NoopSpan(name, {
      spanId: "noop",
      traceId: parent?.traceId ?? "noop",
      parentSpanId: parent?.parentSpanId,
    });
  }
  currentSpan(): Span | null {
    return null;
  }
}

export class NoopMeter implements Meter {
  private noop(name: string, kind: MetricSeries["kind"]): MetricSeries {
    return {
      name,
      kind,
      inc() {},
      set() {},
      observe() {},
    };
  }
  counter(name: string): MetricSeries {
    return this.noop(name, "counter");
  }
  gauge(name: string): MetricSeries {
    return this.noop(name, "gauge");
  }
  histogram(name: string): MetricSeries {
    return this.noop(name, "histogram");
  }
}

export class NoopLogger implements Logger {
  log(): void {}
  trace(): void {}
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  fatal(): void {}
  child(): Logger {
    return this;
  }
}

export class NoopAuditSink implements AuditSink {
  record(): void {}
}

export class NoopProvenanceRecorder implements ProvenanceRecorder {
  recordDecision(): void {}
}

export function NoopObservability(): ObservabilityBundle {
  return {
    tracer: new NoopTracer(),
    meter: new NoopMeter(),
    logger: new NoopLogger(),
    audit: new NoopAuditSink(),
    provenance: new NoopProvenanceRecorder(),
  };
}

// ── ConsoleLogger ───────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export class ConsoleLogger implements Logger {
  constructor(
    private readonly minLevel: LogLevel = "info",
    private readonly bindings: UnknownRecord = {}
  ) {}

  log(record: LogRecord): void {
    if (LEVEL_ORDER[record.level] < LEVEL_ORDER[this.minLevel]) return;
    const payload = {
      level: record.level,
      msg: record.message,
      ts: record.timestamp,
      ...this.bindings,
      ...record.attributes,
    };
    const fn =
      record.level === "error" || record.level === "fatal"
        ? console.error
        : record.level === "warn"
        ? console.warn
        : console.log;
    fn(JSON.stringify(payload));
  }

  private emit(level: LogLevel, message: string, attributes?: UnknownRecord): void {
    this.log({ level, message, timestamp: 0, attributes: attributes ?? {} });
  }

  trace(m: string, a?: UnknownRecord) { this.emit("trace", m, a); }
  debug(m: string, a?: UnknownRecord) { this.emit("debug", m, a); }
  info(m: string, a?: UnknownRecord) { this.emit("info", m, a); }
  warn(m: string, a?: UnknownRecord) { this.emit("warn", m, a); }
  error(m: string, a?: UnknownRecord) { this.emit("error", m, a); }
  fatal(m: string, a?: UnknownRecord) { this.emit("fatal", m, a); }

  child(bindings: UnknownRecord): Logger {
    return new ConsoleLogger(this.minLevel, { ...this.bindings, ...bindings });
  }
}

// ── InMemoryMeter ───────────────────────────────────────────────────────────

export interface MetricPoint {
  readonly name: string;
  readonly kind: MetricSeries["kind"];
  readonly value: number;
  readonly attributes?: UnknownRecord;
  readonly at: number;
}

export class InMemoryMeter implements Meter {
  readonly points: MetricPoint[] = [];
  private series(name: string, kind: MetricSeries["kind"]): MetricSeries {
    return {
      name,
      kind,
      inc: (by = 1, attributes) => this.points.push({ name, kind, value: by, attributes, at: this.seq++ }),
      set: (value, attributes) => this.points.push({ name, kind, value, attributes, at: this.seq++ }),
      observe: (value, attributes) => this.points.push({ name, kind, value, attributes, at: this.seq++ }),
    };
  }
  private seq = 0;
  counter(name: string) { return this.series(name, "counter"); }
  gauge(name: string) { return this.series(name, "gauge"); }
  histogram(name: string) { return this.series(name, "histogram"); }
}

// ── InMemoryAuditSink ───────────────────────────────────────────────────────

export class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  record(event: AuditEvent): void {
    this.events.push(event);
  }
}

// ── InMemoryTracer ──────────────────────────────────────────────────────────

export class InMemoryTracer implements Tracer {
  readonly spans: Array<Span & { endedAt?: number; attributes: Record<string, unknown>; error?: unknown }> = [];
  private current: (Span & { attributes: Record<string, unknown> }) | null = null;
  private seq = 0;

  startSpan(name: string, parent?: SpanContext, attributes: UnknownRecord = {}): Span {
    const ctx: SpanContext = {
      spanId: "span-" + ++this.seq,
      traceId: parent?.traceId ?? "trace-" + this.seq,
      parentSpanId: parent?.spanId,
    };
    const record = {
      name,
      context: ctx,
      startedAt: 0,
      attributes: { ...attributes } as Record<string, unknown>,
      end: (at?: number) => {
        record.endedAt = at ?? 0;
      },
      setAttribute: (k: string, v: unknown) => {
        record.attributes[k] = v;
      },
      recordError: (e: unknown) => {
        record.error = e;
      },
    } as Span & { endedAt?: number; attributes: Record<string, unknown>; error?: unknown };
    this.spans.push(record);
    this.current = record;
    return record;
  }

  currentSpan(): Span | null {
    return this.current;
  }
}

// ── InMemoryProvenanceRecorder ──────────────────────────────────────────────

export class InMemoryProvenanceRecorder implements ProvenanceRecorder {
  readonly records: DecisionProvenance[] = [];
  recordDecision(
    decisionId: string,
    decisionType: string,
    inputs: UnknownRecord,
    sourceEventIds: readonly string[]
  ): void {
    this.records.push({
      decisionId,
      decisionType,
      inputs,
      sourceEventIds,
      recordedAt: 0,
    });
  }
}
