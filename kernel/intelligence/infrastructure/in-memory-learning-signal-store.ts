/**
 * @kernel/intelligence/infrastructure/in-memory-learning-signal-store —
 * `InMemoryLearningSignalStore`.
 *
 * Append-only journal of `LearningSignal` records. The kernel STORES learning
 * signals but NEVER trains models — training is the responsibility of an
 * external AI provider that reads this journal.
 *
 * Storage:
 *   - `store`: `Map<id, LearningSignal>` (re-recording an id replaces in place —
 *      idempotent).
 *   - `bySubject`: `Map<subjectKey, Set<id>>` for filtered listing without a
 *      full scan.
 *
 * `list` returns signals sorted by timestamp ascending, then id ascending
 * (stable). `aggregate` computes deterministic count / avgConfidence / per-
 * metric avg-min-max over the matching subject's signals.
 *
 * Determinism: NO `Date.now()` / `Math.random()`. Signals carry their own
 * `timestamp` (sourced by the producer from a `RuntimeClock`). Identical
 * recorded set → identical list + aggregate.
 */
import type {
  LearningSignal,
  LearningSignalStore,
  LearningSignalFilter,
  LearningSignalAggregate,
  MetricAggregate,
} from "../domain";

export class InMemoryLearningSignalStore implements LearningSignalStore {
  private readonly store = new Map<string, LearningSignal>();
  private readonly bySubject = new Map<string, Set<string>>();

  record(signal: LearningSignal): void {
    this.store.set(signal.id, signal);
    const key = subjectKey(signal.subjectKind, signal.subjectId);
    let set = this.bySubject.get(key);
    if (!set) {
      set = new Set();
      this.bySubject.set(key, set);
    }
    set.add(signal.id);
  }

  list(filter?: LearningSignalFilter): readonly LearningSignal[] {
    let signals: LearningSignal[];
    if (!filter) {
      signals = [...this.store.values()];
    } else {
      const matching: LearningSignal[] = [];
      for (const s of this.store.values()) {
        if (
          filter.subjectKind !== undefined &&
          s.subjectKind !== filter.subjectKind
        ) {
          continue;
        }
        if (
          filter.subjectId !== undefined &&
          s.subjectId !== filter.subjectId
        ) {
          continue;
        }
        if (filter.source !== undefined && s.source !== filter.source) {
          continue;
        }
        matching.push(s);
      }
      signals = matching;
    }
    signals.sort((a, b) =>
      a.timestamp !== b.timestamp
        ? a.timestamp - b.timestamp
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
    );
    return signals;
  }

  aggregate(
    subjectKind: string,
    subjectId: string
  ): LearningSignalAggregate {
    const key = subjectKey(subjectKind, subjectId);
    const ids = this.bySubject.get(key);
    if (!ids || ids.size === 0) {
      return { count: 0, avgConfidence: 0, metrics: {} };
    }
    let confidenceSum = 0;
    const metricAggs = new Map<string, { sum: number; min: number; max: number; n: number }>();
    let n = 0;
    for (const id of ids) {
      const s = this.store.get(id);
      if (!s) continue;
      n++;
      confidenceSum += s.confidence;
      for (const [name, value] of Object.entries(s.metrics)) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        let agg = metricAggs.get(name);
        if (!agg) {
          agg = { sum: value, min: value, max: value, n: 1 };
          metricAggs.set(name, agg);
        } else {
          agg.sum += value;
          if (value < agg.min) agg.min = value;
          if (value > agg.max) agg.max = value;
          agg.n += 1;
        }
      }
    }
    if (n === 0) {
      return { count: 0, avgConfidence: 0, metrics: {} };
    }
    const metrics: Record<string, MetricAggregate> = {};
    for (const [name, agg] of metricAggs) {
      metrics[name] = {
        avg: agg.sum / agg.n,
        min: agg.min,
        max: agg.max,
      };
    }
    return {
      count: n,
      avgConfidence: confidenceSum / n,
      metrics,
    };
  }

  /** Test-only / introspection: total recorded signal count. */
  size(): number {
    return this.store.size;
  }
}

function subjectKey(subjectKind: string, subjectId: string): string {
  return `${subjectKind}#${subjectId}`;
}
