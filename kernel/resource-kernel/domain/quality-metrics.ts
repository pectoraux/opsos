/**
 * @kernel/resource-kernel/domain/quality-metrics — the QualityMetrics PORT.
 *
 * Tracks a rolling quality score per resource — the empirical success rate of
 * work performed by the resource. The Coordination Kernel uses this to
 * discriminate between equally-capable, equally-available resources: a
 * resource with a 0.98 quality score is preferred over one with 0.72.
 *
 * The rolling score is computed over the last `windowSize` outcomes (default
 * 100). `recordOutcome(resourceId, success, now)` appends an outcome; the
 * score is `successCount / totalCount` over the window. Resources with no
 * recorded outcomes default to `1.0` (optimistic — a new resource is assumed
 * good until proven otherwise).
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { ResourceId } from "@kernel/shared-kernel";

/**
 * A single recorded outcome.
 */
export interface QualityOutcome {
  readonly resourceId: ResourceId;
  readonly success: boolean;
  readonly recordedAt: number;
}

/**
 * The QualityMetrics PORT.
 */
export interface QualityMetrics {
  /**
   * Returns the rolling quality score for the resource in `[0, 1]`. Returns
   * `1.0` if no outcomes have been recorded (optimistic default).
   */
  getScore(resourceId: ResourceId): number;
  /**
   * Records an outcome. Appends to the rolling window (evicting the oldest
   * entry if the window is full) and recomputes the score.
   */
  recordOutcome(resourceId: ResourceId, success: boolean, now: number): void;
  /**
   * Returns the rolling window of recorded outcomes for the resource
   * (oldest-first). Returns `[]` if none.
   */
  getOutcomes(resourceId: ResourceId): readonly QualityOutcome[];
  /**
   * Returns the configured window size (max outcomes retained per resource).
   */
  getWindowSize(): number;
}

/**
 * The default rolling-window size. Outcomes beyond this count are evicted
 * FIFO.
 */
export const DEFAULT_QUALITY_WINDOW_SIZE = 100;

/**
 * The default quality score for a resource with no recorded outcomes.
 * Optimistic — a new resource is assumed good until proven otherwise.
 */
export const DEFAULT_QUALITY_SCORE = 1.0;
