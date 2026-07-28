/**
 * @kernel/intelligence/infrastructure/default-anomaly-detector —
 * `DefaultAnomalyDetector`.
 *
 * Deterministic, rule-based `AnomalyDetector`. Surfaces deviations from
 * expected operational behaviour by inspecting the injected
 * `IntelligenceGraph` and caller-supplied `context` signals.
 *
 * Detection rules (one per `AnomalyKind`):
 *   - unusual-event-sequence: events not monotonically non-decreasing by
 *     timestamp.
 *   - policy-violation: `context.policyViolations` non-empty.
 *   - resource-degradation: `context.healthSamples` declining > 30%.
 *   - unexpected-retries: `context.retries` ≥ 3.
 *   - execution-loop: `context.executions` contains duplicate ids.
 *   - orphaned-work: graph work nodes with no incoming edges.
 *   - stalled-workflow: `context.stalledWorkflows` non-empty.
 *   - inconsistent-knowledge: `context.knowledgeConflicts` non-empty.
 *
 * Severity is a deterministic function of signal strength. This is NOT an AI —
 * it is a deterministic baseline. AI/ML-backed detectors implement the same
 * port.
 *
 * Determinism: NO `Date.now()` / `Math.random()`. `detectedAt` is sourced from
 * the injected `RuntimeClock` (or `context.now`, default 0). Identical
 * (context, graph, clock) → identical anomalies. Output sorted by severity desc
 * then id asc.
 */
import type { RuntimeClock } from "@kernel/shared-kernel";
import type {
  Anomaly,
  AnomalyDetector,
  AnomalyKind,
  AnomalySeverity,
  IntelligenceGraph,
} from "../domain";

export interface DefaultAnomalyDetectorOptions {
  readonly graph?: IntelligenceGraph;
  readonly clock?: RuntimeClock;
}

export class DefaultAnomalyDetector implements AnomalyDetector {
  private readonly graph: IntelligenceGraph | undefined;
  private readonly clock: RuntimeClock | undefined;

  constructor(options: DefaultAnomalyDetectorOptions = {}) {
    this.graph = options.graph;
    this.clock = options.clock;
  }

  detect(
    context?: Readonly<Record<string, unknown>>
  ): readonly Anomaly[] {
    const ctx = context ?? {};
    const now = this.clock ? this.clock.now() : readNumber(ctx, "now", 0);
    const anomalies: Anomaly[] = [];

    // ── unusual-event-sequence ─────────────────────────────────────────
    const events = readArray<Record<string, unknown>>(ctx, "events");
    if (events.length >= 2) {
      let inversions = 0;
      let firstOffender: string | undefined;
      for (let i = 1; i < events.length; i++) {
        const prev = readNumber(events[i - 1], "timestamp", 0);
        const curr = readNumber(events[i], "timestamp", 0);
        if (curr < prev) {
          inversions++;
          if (firstOffender === undefined) {
            firstOffender = String(events[i].id ?? `event-${i}`);
          }
        }
      }
      if (inversions > 0) {
        const severity: AnomalySeverity = inversions > 2 ? "critical" : "warn";
        anomalies.push(
          this.makeAnomaly(
            "unusual-event-sequence",
            "event",
            firstOffender ?? "sequence",
            severity,
            `Detected ${inversions} out-of-order event(s) by timestamp — the event stream is not monotonic.`,
            now,
            [`${inversions} timestamp inversion(s) in ${events.length} events`]
          )
        );
      }
    }

    // ── policy-violation ───────────────────────────────────────────────
    const violations = readArray<Record<string, unknown>>(ctx, "policyViolations");
    if (violations.length > 0) {
      const severity: AnomalySeverity =
        violations.length >= 3 ? "critical" : "warn";
      const firstId = String(violations[0].id ?? violations[0].policyId ?? "policy");
      anomalies.push(
        this.makeAnomaly(
          "policy-violation",
          "policy",
          firstId,
          severity,
          `${violations.length} policy violation(s) recorded recently.`,
          now,
          violations.map((v) => `violation:${String(v.id ?? v.policyId ?? "?")}`)
        )
      );
    }

    // ── resource-degradation ──────────────────────────────────────────
    const health = readNumbers(ctx, "healthSamples");
    if (health.length >= 2) {
      const first = health[0];
      const last = health[health.length - 1];
      const decline = first > 0 ? (first - last) / first : 0;
      if (decline > 0.3 || last < 0.3) {
        const severity: AnomalySeverity =
          decline > 0.5 || last < 0.2 ? "critical" : "warn";
        const resourceId = readString(ctx, "resourceId", "resource");
        anomalies.push(
          this.makeAnomaly(
            "resource-degradation",
            "resource",
            resourceId,
            severity,
            `Resource '${resourceId}' health declined from ${first.toFixed(2)} to ${last.toFixed(2)} (${Math.round(decline * 100)}% drop).`,
            now,
            health.map((h, i) => `t${i}=${h.toFixed(2)}`)
          )
        );
      }
    }

    // ── unexpected-retries ─────────────────────────────────────────────
    const retries = readNumber(ctx, "retries", 0);
    if (retries >= 3) {
      const severity: AnomalySeverity = retries >= 5 ? "critical" : "warn";
      const executionId = readString(ctx, "executionId", "execution");
      anomalies.push(
        this.makeAnomaly(
          "unexpected-retries",
          "execution",
          executionId,
          severity,
          `Execution '${executionId}' retried ${retries} time(s) — exceeds the expected retry budget.`,
          now,
          [`retries=${retries}`]
        )
      );
    }

    // ── execution-loop ────────────────────────────────────────────────
    const executions = readArray<Record<string, unknown>>(ctx, "executions");
    if (executions.length > 0) {
      const counts = new Map<string, number>();
      for (const e of executions) {
        const id = String(e.id ?? e.executionId ?? "?");
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const [id, count] of counts) {
        if (count > 1) {
          const severity: AnomalySeverity = count >= 3 ? "critical" : "warn";
          anomalies.push(
            this.makeAnomaly(
              "execution-loop",
              "execution",
              id,
              severity,
              `Execution '${id}' appears ${count} time(s) — possible retry loop.`,
              now,
              [`execution:${id} count=${count}`]
            )
          );
        }
      }
    }

    // ── orphaned-work (graph-derived) ─────────────────────────────────
    if (this.graph) {
      const workNodes = this.graph.query({ kind: "work" });
      let orphanCount = 0;
      for (const w of workNodes) {
        const inbound = this.graph.getNeighbors(w.id, "in");
        if (inbound.length === 0) {
          orphanCount++;
          anomalies.push(
            this.makeAnomaly(
              "orphaned-work",
              "work",
              w.id,
              "info",
              `Work node '${w.label}' (${w.id}) has no inbound causes/assignments — it may be untracked.`,
              now,
              [`work:${w.id} inbound-edges=0`]
            )
          );
        }
      }
      if (orphanCount >= 5) {
        anomalies.push(
          this.makeAnomaly(
            "orphaned-work",
            "graph",
            "orphaned-work-summary",
            "warn",
            `${orphanCount} orphaned work nodes detected — graph integrity may be compromised.`,
            now,
            [`orphan-count=${orphanCount}`]
          )
        );
      }
    }

    // ── stalled-workflow ──────────────────────────────────────────────
    const stalled = readArray<Record<string, unknown>>(ctx, "stalledWorkflows");
    if (stalled.length > 0) {
      for (const w of stalled) {
        const id = String(w.id ?? w.workflowId ?? "workflow");
        const since = readNumber(w, "sinceMs", 0);
        anomalies.push(
          this.makeAnomaly(
            "stalled-workflow",
            "workflow",
            id,
            "warn",
            `Workflow '${id}' has been stalled for ${since}ms — no stage progression.`,
            now,
            [`workflow:${id} stalled-since-ms=${since}`]
          )
        );
      }
    }

    // ── inconsistent-knowledge ────────────────────────────────────────
    const conflicts = readArray<Record<string, unknown>>(ctx, "knowledgeConflicts");
    if (conflicts.length > 0) {
      const severity: AnomalySeverity =
        conflicts.length >= 3 ? "critical" : "warn";
      const firstId = String(conflicts[0].id ?? conflicts[0].knowledgeId ?? "knowledge");
      anomalies.push(
        this.makeAnomaly(
          "inconsistent-knowledge",
          "knowledge",
          firstId,
          severity,
          `${conflicts.length} knowledge conflict(s) detected — conflicting facts for the same subject.`,
          now,
          conflicts.map((c) => `conflict:${String(c.id ?? c.knowledgeId ?? "?")}`)
        )
      );
    }

    // ── Sort by severity desc, then id asc ────────────────────────────
    anomalies.sort((a, b) => {
      const sa = SEVERITY_RANK[a.severity];
      const sb = SEVERITY_RANK[b.severity];
      if (sa !== sb) return sa - sb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return anomalies;
  }

  private makeAnomaly(
    kind: AnomalyKind,
    subjectKind: string,
    subjectId: string,
    severity: AnomalySeverity,
    description: string,
    detectedAt: number,
    evidence: readonly string[]
  ): Anomaly {
    return {
      id: `anom#${kind}#${subjectKind}#${subjectId}`,
      kind,
      subjectKind,
      subjectId,
      severity,
      description,
      detectedAt,
      evidence,
    };
  }
}

const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  critical: 0,
  warn: 1,
  info: 2,
};

// ── Deterministic context readers ─────────────────────────────────────────

function readArray<T>(
  ctx: Readonly<Record<string, unknown>>,
  key: string
): T[] {
  const v = ctx[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function readNumbers(
  ctx: Readonly<Record<string, unknown>>,
  key: string
): number[] {
  const v = ctx[key];
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) {
    if (typeof x === "number" && Number.isFinite(x)) out.push(x);
  }
  return out;
}

function readNumber(
  ctx: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number
): number {
  const v = ctx[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function readString(
  ctx: Readonly<Record<string, unknown>>,
  key: string,
  fallback: string
): string {
  const v = ctx[key];
  return typeof v === "string" ? v : fallback;
}
