/**
 * @kernel/intelligence/domain/learning-signal — the LearningSignal primitive and
 * the LearningSignalStore PORT.
 *
 * A LearningSignal is the kernel's record of an observed outcome vs. the
 * expected outcome — the raw material any future learning system (RL, online
 * optimiser, model trainer) would consume.
 *
 * CRITICAL INVARIANT: the kernel STORES learning signals but NEVER trains
 * models. Intelligence NEVER performs work. The store is an append-only journal
 * of (observed, expected, confidence, metrics) tuples; training is the
 * responsibility of an external AI provider that reads the journal and produces
 * a model — the kernel never does this in-process.
 *
 * `aggregate` computes deterministic summary statistics (count, average
 * confidence, per-metric avg/min/max) so a UI or an external trainer can read a
 * compact view without re-scanning the whole journal.
 */
import type { RuntimeClock } from "@kernel/shared-kernel";

/**
 * LearningSignal — an immutable record of observed-vs-expected outcome.
 *
 * `observedOutcome` / `expectedOutcome` are opaque, serialisable bags (no
 * functions, no Date instances). `confidence` ∈ [0, 1] is the recorder's
 * confidence in the observation. `metrics` is a flat map of numeric measurements
 * (e.g. `{ durationMs: 4200, retries: 1 }`).
 *
 * `timestamp` is an epoch-millis sourced from a `RuntimeClock` (never
 * `Date.now()` inside the deterministic core). `source` identifies the producer
 * (e.g. "runtime-executor", "conformance-engine").
 */
export interface LearningSignal {
  readonly id: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly observedOutcome: Readonly<Record<string, unknown>>;
  readonly expectedOutcome: Readonly<Record<string, unknown>>;
  readonly confidence: number;
  readonly source: string;
  readonly timestamp: number;
  readonly metrics: Readonly<Record<string, number>>;
}

/** Filter for `LearningSignalStore.list`. All present fields must match. */
export interface LearningSignalFilter {
  readonly subjectKind?: string;
  readonly subjectId?: string;
  readonly source?: string;
}

/** Per-metric aggregate statistics. */
export interface MetricAggregate {
  readonly avg: number;
  readonly min: number;
  readonly max: number;
}

/** Aggregate view of a subject's learning signals. */
export interface LearningSignalAggregate {
  readonly count: number;
  readonly avgConfidence: number;
  readonly metrics: Readonly<Record<string, MetricAggregate>>;
}

/**
 * LearningSignalStore — PORT. Append-only journal of learning signals.
 *
 * `record` is idempotent on `id` (re-recording replaces in place — the journal
 * is mutable by the recorder but the historical record per id is stable).
 *
 * `list` returns signals sorted by timestamp ascending then id ascending.
 *
 * `aggregate` returns deterministic summary statistics for a subject.
 */
export interface LearningSignalStore {
  record(signal: LearningSignal): void;
  list(filter?: LearningSignalFilter): readonly LearningSignal[];
  aggregate(subjectKind: string, subjectId: string): LearningSignalAggregate;
}

/**
 * Optional dependency hint — the store itself does not need a clock (signals
 * carry their own `timestamp`), but this re-export documents that producers of
 * learning signals SHOULD source `timestamp` from a `RuntimeClock`.
 */
export type { RuntimeClock };
