/**
 * @kernel/twin-runtime/domain/twin-health — the TwinHealth aggregate +
 * TwinIssue + HealthMonitor PORT.
 *
 * Health is computed from telemetry by the HealthMonitor. A `TwinHealth`
 * aggregates a 0..1 score, a coarse status, and a list of detected issues.
 *
 * Determinism rule: pure types — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument supplied by the caller.
 */

import type { TelemetryReading } from "./twin-telemetry";

/** Coarse health status. `unknown` is used when no telemetry is available. */
export type TwinHealthStatus = "healthy" | "degraded" | "critical" | "unknown";

/** Issue severity (mirrors the resource-kernel's ResourceIssue severity). */
export type TwinIssueSeverity = "info" | "warn" | "critical";

/** A single detected health issue. */
export interface TwinIssue {
  readonly id: string;
  readonly severity: TwinIssueSeverity;
  readonly category: string;
  readonly message: string;
  /** Epoch-millis from the RuntimeClock / `now` argument. */
  readonly detectedAt: number;
}

/**
 * The health of a single entity's twin, computed by the HealthMonitor.
 */
export interface TwinHealth {
  readonly entityId: string;
  readonly healthScore: number; // 0..1
  readonly status: TwinHealthStatus;
  readonly issues: readonly TwinIssue[];
  readonly lastEvaluatedAt: number;
}

/**
 * The HealthMonitor PORT. `evaluate` is a pure function of
 * `(entityId, telemetry, now)`; the latest evaluation per entity is cached
 * for `getHealth` / `listIssues`.
 */
export interface HealthMonitor {
  evaluate(entityId: string, telemetry: readonly TelemetryReading[], now: number): TwinHealth;
  getHealth(entityId: string): TwinHealth | undefined;
  listIssues(entityId: string): readonly TwinIssue[];
}
