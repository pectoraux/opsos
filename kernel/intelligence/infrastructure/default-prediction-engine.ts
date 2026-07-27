/**
 * @kernel/intelligence/infrastructure/default-prediction-engine —
 * `DefaultPredictionEngine`.
 *
 * Deterministic MOCK `PredictionEngine`. Contains NO machine learning — it uses
 * simple, well-understood heuristics:
 *   - moving average for level metrics (execution-duration, resource-utilization,
 *     quality);
 *   - linear extrapolation for trend metrics (queue-growth, demand);
 *   - rate extrapolation for count metrics (failures, compliance-risk);
 *   - a direct passthrough heuristic for congestion.
 *
 * This exists so the intelligence contracts can be exercised in self-test and
 * conformance. Real ML / RL / LLM predictors implement the same port and slot
 * in later — the kernel owns the WHAT (a Prediction), AI owns the HOW.
 *
 * Determinism: NO `Date.now()` / `Math.random()`. `confidence` is a
 * deterministic function of how much input data was supplied (data availability
 * proxy), NOT a statistical claim. Identical (metric, context, horizon) →
 * identical Prediction.
 */
import { hashSeed } from "@kernel/shared-kernel";
import type { Prediction, PredictionEngine, PredictionMetric } from "../domain";

export class DefaultPredictionEngine implements PredictionEngine {
  predict(
    metric: PredictionMetric,
    context?: Readonly<Record<string, unknown>>,
    horizon?: number
  ): Prediction {
    const ctx = context ?? {};
    const h = horizon ?? DEFAULT_HORIZON[metric];
    const cfg = METRIC_CONFIG[metric];
    const result = cfg.compute(ctx, h);

    const id = `pred#${metric}#${h}`;
    const inputHash = hashSeed(stableStringify({ metric, ctx, h }))
      .toString(16)
      .padStart(8, "0");

    return {
      id,
      metric,
      predictedValue: result.value,
      ...(cfg.unit !== undefined ? { unit: cfg.unit } : {}),
      confidence: clamp01(result.confidence),
      horizon: h,
      method: result.method,
      assumptions: [
        ...cfg.assumptions,
        `Input data hash: ${inputHash} (deterministic).`,
        "No machine learning was used — value derived by deterministic heuristic.",
      ],
    };
  }
}

// ── Per-metric configuration ──────────────────────────────────────────────

interface MetricConfig {
  readonly unit?: string;
  readonly assumptions: readonly string[];
  readonly compute: (
    ctx: Readonly<Record<string, unknown>>,
    horizon: number
  ) => { readonly value: number; readonly confidence: number; readonly method: string };
}

const DEFAULT_HORIZON: Record<PredictionMetric, number> = {
  "execution-duration": 60_000,
  "queue-growth": 300_000,
  "resource-utilization": 300_000,
  failures: 3_600_000,
  congestion: 300_000,
  demand: 3_600_000,
  quality: 3_600_000,
  "compliance-risk": 86_400_000,
};

const METRIC_CONFIG: Record<PredictionMetric, MetricConfig> = {
  "execution-duration": {
    unit: "ms",
    assumptions: [
      "Future executions resemble the recent sample (stationarity).",
      "No resource degradation or load shift is modelled.",
    ],
    compute: (ctx) => {
      const history = readNumbers(ctx, "history");
      const ma = movingAverage(history);
      return {
        value: ma.value,
        confidence: ma.confidence,
        method: `moving-average(n=${ma.n})`,
      };
    },
  },
  "queue-growth": {
    unit: "entries",
    assumptions: [
      "Queue growth continues at the recent linear rate.",
      "No backpressure or auto-scaling intervenes.",
    ],
    compute: (ctx, horizon) => {
      const sizes = readNumbers(ctx, "queueSizes");
      const interval = readNumber(ctx, "intervalMs", 60_000);
      const ex = linearExtrapolate(sizes, horizon, interval);
      return {
        value: ex.value,
        confidence: ex.confidence,
        method: `linear-extrapolation(n=${ex.n}, interval=${interval}ms)`,
      };
    },
  },
  "resource-utilization": {
    unit: "ratio",
    assumptions: [
      "Future utilisation resembles the recent sample (stationarity).",
      "Capacity is unchanged over the horizon.",
    ],
    compute: (ctx) => {
      const samples = readNumbers(ctx, "utilizationSamples");
      const ma = movingAverage(samples);
      const v = samples.length === 0 ? readNumber(ctx, "utilization", 0.5) : ma.value;
      return {
        value: clamp(v, 0, 1),
        confidence: ma.confidence,
        method:
          samples.length === 0
            ? "passthrough(utilization)"
            : `moving-average(n=${ma.n})`,
      };
    },
  },
  failures: {
    unit: "count",
    assumptions: [
      "Failures occur at the recent observed rate.",
      "No reliability improvement or regression is modelled.",
    ],
    compute: (ctx, horizon) => {
      const ratePerMs = readNumber(ctx, "failureRatePerMs", 0);
      const hasRate = readHas(ctx, "failureRatePerMs");
      return {
        value: Math.max(0, ratePerMs * horizon),
        confidence: hasRate ? 0.45 : 0.2,
        method: hasRate
          ? `rate-extrapolation(rate=${ratePerMs.toExponential(2)}/ms, horizon=${horizon}ms)`
          : "rate-extrapolation(no-rate, default 0)",
      };
    },
  },
  congestion: {
    unit: "ratio",
    assumptions: [
      "Congestion level is sustained over the horizon.",
      "No traffic-shaping or rerouting is modelled.",
    ],
    compute: (ctx) => {
      const level = clamp(readNumber(ctx, "congestionLevel", 0), 0, 1);
      const hasLevel = readHas(ctx, "congestionLevel");
      return {
        value: level,
        confidence: hasLevel ? 0.4 : 0.2,
        method: hasLevel
          ? `heuristic-passthrough(congestionLevel=${level})`
          : "heuristic-passthrough(no-input, default 0)",
      };
    },
  },
  demand: {
    unit: "count",
    assumptions: [
      "Demand continues at the recent linear trend.",
      "No seasonality or campaign effects are modelled.",
    ],
    compute: (ctx, horizon) => {
      const history = readNumbers(ctx, "demandHistory");
      const interval = readNumber(ctx, "intervalMs", 60_000);
      const ex = linearExtrapolate(history, horizon, interval);
      return {
        value: Math.max(0, ex.value),
        confidence: ex.confidence,
        method: `linear-extrapolation(n=${ex.n}, interval=${interval}ms)`,
      };
    },
  },
  quality: {
    unit: "ratio",
    assumptions: [
      "Quality remains at the recent sample average.",
      "No process change or drift is modelled.",
    ],
    compute: (ctx) => {
      const samples = readNumbers(ctx, "qualitySamples");
      const ma = movingAverage(samples);
      return {
        value: clamp(ma.value, 0, 1),
        confidence: ma.confidence,
        method: `moving-average(n=${ma.n})`,
      };
    },
  },
  "compliance-risk": {
    unit: "count",
    assumptions: [
      "Compliance violations occur at the recent observed rate.",
      "No policy change or control improvement is modelled.",
    ],
    compute: (ctx, horizon) => {
      const ratePerMs = readNumber(ctx, "violationRatePerMs", 0);
      const hasRate = readHas(ctx, "violationRatePerMs");
      return {
        value: Math.max(0, ratePerMs * horizon),
        confidence: hasRate ? 0.45 : 0.2,
        method: hasRate
          ? `rate-extrapolation(rate=${ratePerMs.toExponential(2)}/ms, horizon=${horizon}ms)`
          : "rate-extrapolation(no-rate, default 0)",
      };
    },
  },
};

// ── Deterministic statistical helpers ─────────────────────────────────────

function movingAverage(values: readonly number[]): {
  value: number;
  confidence: number;
  n: number;
} {
  const n = values.length;
  if (n === 0) {
    return { value: 0, confidence: 0.2, n: 0 };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  const value = sum / n;
  const confidence = Math.min(0.3 + 0.1 * n, 0.9);
  return { value, confidence, n };
}

function linearExtrapolate(
  values: readonly number[],
  horizon: number,
  interval: number
): { value: number; confidence: number; n: number } {
  const n = values.length;
  if (n === 0) return { value: 0, confidence: 0.2, n: 0 };
  if (n === 1) {
    return { value: values[0], confidence: 0.25, n: 1 };
  }
  const first = values[0];
  const last = values[n - 1];
  const slope = (last - first) / (n - 1); // per interval
  const safeInterval = interval > 0 ? interval : 60_000;
  const steps = horizon / safeInterval;
  const value = last + slope * steps;
  const confidence = Math.min(0.3 + 0.1 * n, 0.85);
  return { value, confidence, n };
}

// ── Deterministic context readers ─────────────────────────────────────────

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

function readHas(
  ctx: Readonly<Record<string, unknown>>,
  key: string
): boolean {
  const v = ctx[key];
  return typeof v === "number" && Number.isFinite(v);
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

/** Stable, key-sorted JSON serialisation for deterministic hashing. */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}
