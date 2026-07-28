/**
 * @kernel/twin-runtime/infrastructure/default-health-monitor — the default
 * rule-based `HealthMonitor`.
 *
 * Deterministic, protocol-free health evaluation:
 *   - For each metric, take the latest reading (by timestamp).
 *   - If a metric has no readings: contributes nothing.
 *   - Per-metric quality < 0.8 → issue (critical if < 0.2, warn if < 0.5,
 *     info if < 0.8).
 *   - healthScore = mean of latest readings' qualities (or 0 if no readings).
 *   - status: critical if any critical issue, degraded if any warn,
 *     healthy otherwise; unknown if no telemetry at all.
 *
 * No `Date.now()` / `Math.random()`. The `now` argument is used only for
 * `detectedAt` / `lastEvaluatedAt`.
 */

import type {
  TelemetryReading,
  TwinHealth,
  TwinIssue,
  TwinHealthStatus,
  TwinIssueSeverity,
  HealthMonitor,
} from "../domain";
import { clampUnit } from "../domain";

const CRITICAL_QUALITY = 0.2;
const WARN_QUALITY = 0.5;
const INFO_QUALITY = 0.8;

function severityForQuality(q: number): TwinIssueSeverity | null {
  if (q < CRITICAL_QUALITY) return "critical";
  if (q < WARN_QUALITY) return "warn";
  if (q < INFO_QUALITY) return "info";
  return null;
}

export class DefaultHealthMonitor implements HealthMonitor {
  private readonly byEntity = new Map<string, TwinHealth>();

  evaluate(entityId: string, telemetry: readonly TelemetryReading[], now: number): TwinHealth {
    // Group latest reading per metric.
    const latestByMetric = new Map<string, TelemetryReading>();
    for (const r of telemetry) {
      const cur = latestByMetric.get(r.metric);
      if (!cur || r.timestamp > cur.timestamp) latestByMetric.set(r.metric, r);
    }

    const issues: TwinIssue[] = [];
    let scoreSum = 0;
    let scoreCount = 0;
    let issueIndex = 0;
    for (const [metric, reading] of latestByMetric) {
      const q = clampUnit(reading.quality);
      scoreSum += q;
      scoreCount++;
      const sev = severityForQuality(q);
      if (sev) {
        issues.push({
          id: `issue#${entityId}#${metric}#${issueIndex}`,
          severity: sev,
          category: "telemetry-quality",
          message: `Telemetry quality for metric '${metric}' is ${q.toFixed(2)} (below ${INFO_QUALITY})`,
          detectedAt: now,
        });
        issueIndex++;
      }
    }

    const healthScore = scoreCount > 0 ? clampUnit(scoreSum / scoreCount) : 0;
    let status: TwinHealthStatus;
    if (scoreCount === 0) {
      status = "unknown";
    } else if (issues.some((x) => x.severity === "critical")) {
      status = "critical";
    } else if (issues.some((x) => x.severity === "warn")) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    const health: TwinHealth = {
      entityId,
      healthScore,
      status,
      issues,
      lastEvaluatedAt: now,
    };
    this.byEntity.set(entityId, health);
    return health;
  }

  getHealth(entityId: string): TwinHealth | undefined {
    return this.byEntity.get(entityId);
  }

  listIssues(entityId: string): readonly TwinIssue[] {
    return this.byEntity.get(entityId)?.issues ?? [];
  }
}
