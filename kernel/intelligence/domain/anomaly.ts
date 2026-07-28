/**
 * @kernel/intelligence/domain/anomaly — the Anomaly primitive and the
 * AnomalyDetector PORT.
 *
 * An Anomaly is a detected deviation from expected operational behaviour.
 * Intelligence NEVER performs work and NEVER modifies state: an Anomaly is a
 * read-only observation surfaced for an operator (or an external automation) to
 * act on through the kernel's command side.
 *
 * `AnomalyKind` enumerates the detectable anomaly classes. The list is
 * additive.
 *
 * `severity` triages the anomaly: `info` (worth noting), `warn` (likely needs
 * attention), `critical` (act now). Severity is a deterministic function of the
 * detected signal strength in the default detector.
 *
 * The default `DefaultAnomalyDetector` is rule-based and deterministic. AI /
 * ML-backed detectors implement the same port.
 */

/** Detectable anomaly classes. FROZEN. */
export type AnomalyKind =
  | "unusual-event-sequence"
  | "policy-violation"
  | "resource-degradation"
  | "unexpected-retries"
  | "execution-loop"
  | "orphaned-work"
  | "stalled-workflow"
  | "inconsistent-knowledge";

/** Anomaly severity triage. */
export type AnomalySeverity = "info" | "warn" | "critical";

/**
 * Anomaly — an immutable detected deviation. `detectedAt` is an epoch-millis
 * timestamp sourced from a `RuntimeClock` (never `Date.now()` inside the
 * deterministic core). `evidence` is a list of human-readable pointers
 * (node ids, event ids, metric snapshots) that justify the detection.
 */
export interface Anomaly {
  readonly id: string;
  readonly kind: AnomalyKind;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly severity: AnomalySeverity;
  readonly description: string;
  readonly detectedAt: number;
  readonly evidence: readonly string[];
}

/**
 * AnomalyDetector — PORT. Produces a deterministic list of anomalies for the
 * given context. The list is sorted by severity descending (critical → warn →
 * info) then by id ascending for stability.
 */
export interface AnomalyDetector {
  detect(
    context?: Readonly<Record<string, unknown>>
  ): readonly Anomaly[];
}
