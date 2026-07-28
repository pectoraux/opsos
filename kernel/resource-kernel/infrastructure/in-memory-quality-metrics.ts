/**
 * @kernel/resource-kernel/infrastructure/in-memory-quality-metrics — the
 * in-memory `QualityMetrics` implementation.
 *
 * Pure data structure: a `Map<ResourceId, QualityOutcome[]>` holding the
 * rolling window per resource. No `Date.now()`, no `Math.random()`. All time
 * flows through the `now` argument.
 *
 * The rolling score is `successCount / totalCount` over the last
 * `windowSize` outcomes (default `DEFAULT_QUALITY_WINDOW_SIZE = 100`).
 * Resources with no recorded outcomes default to `DEFAULT_QUALITY_SCORE = 1.0`
 * (optimistic — a new resource is assumed good until proven otherwise).
 */

import type { ResourceId } from "@kernel/shared-kernel";
import type { QualityMetrics, QualityOutcome } from "../domain";
import {
  DEFAULT_QUALITY_SCORE,
  DEFAULT_QUALITY_WINDOW_SIZE,
} from "../domain";

export class InMemoryQualityMetrics implements QualityMetrics {
  private readonly windowSize: number;
  private readonly outcomes = new Map<ResourceId, QualityOutcome[]>();

  constructor(windowSize: number = DEFAULT_QUALITY_WINDOW_SIZE) {
    if (windowSize < 1) {
      this.windowSize = DEFAULT_QUALITY_WINDOW_SIZE;
    } else {
      this.windowSize = windowSize;
    }
  }

  getScore(resourceId: ResourceId): number {
    const list = this.outcomes.get(resourceId);
    if (!list || list.length === 0) return DEFAULT_QUALITY_SCORE;
    const successes = list.filter((o) => o.success).length;
    return successes / list.length;
  }

  recordOutcome(
    resourceId: ResourceId,
    success: boolean,
    now: number
  ): void {
    const entry: QualityOutcome = {
      resourceId,
      success,
      recordedAt: now,
    };
    const list = this.outcomes.get(resourceId) ?? [];
    list.push(entry);
    // Evict oldest if window is full.
    while (list.length > this.windowSize) {
      list.shift();
    }
    this.outcomes.set(resourceId, list);
  }

  getOutcomes(resourceId: ResourceId): readonly QualityOutcome[] {
    return this.outcomes.get(resourceId) ?? [];
  }

  getWindowSize(): number {
    return this.windowSize;
  }
}
