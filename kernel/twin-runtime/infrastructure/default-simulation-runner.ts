/**
 * @kernel/twin-runtime/infrastructure/default-simulation-runner — the default
 * deterministic `SimulationRunner`.
 *
 * Projects the twin's current state forward under the caller-supplied
 * assumptions, producing a small fixed set of projected events and outcomes.
 *
 * Algorithm:
 *   - assumedState = the twin's current state, deep-merged with assumptions
 *     (assumption keys override state keys; the reserved keys `growth` and
 *     `horizonMs` are not overlaid onto state).
 *   - For each numeric value V in assumedState, project forward `horizonMs`
 *     (default = 1 hour) using a per-key growth factor read from
 *     `assumptions.growth` (default 0).
 *   - projectedEvents: one "projected-metric" event per projected key.
 *   - outcomes: one SimulationOutcome per projected key (metric = key,
 *     value = projected).
 *
 * Deterministic. No `Math.random()` — the `seed` is hashed into the
 * simulation id but does not perturb projections (the simulation is fully
 * determined by state + assumptions). No `Date.now()` — `now` is the caller
 * argument.
 */

import type { SimulationOutcome } from "@kernel/shared-kernel";
import { hashSeed } from "@kernel/shared-kernel";
import type {
  TwinSimulation,
  SimulationRunner,
  SimulationProjectedEvent,
  TwinRegistry,
} from "../domain";

const DEFAULT_HORIZON_MS = 60 * 60 * 1000; // 1 hour

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export class DefaultSimulationRunner implements SimulationRunner {
  private readonly byEntity = new Map<string, TwinSimulation[]>();

  constructor(private readonly registry: TwinRegistry) {}

  simulate(
    entityId: string,
    scenario: string,
    assumptions: Readonly<Record<string, unknown>>,
    seed: number,
    now: number,
  ): TwinSimulation {
    const twin = this.registry.get(entityId);
    const baseState = (twin?.currentState ?? {}) as Readonly<Record<string, unknown>>;
    const assumedState: Record<string, unknown> = { ...baseState };
    for (const [k, v] of Object.entries(assumptions)) {
      if (k === "growth" || k === "horizonMs") continue;
      assumedState[k] = v;
    }

    const horizonMs = isFiniteNumber(assumptions.horizonMs)
      ? (assumptions.horizonMs as number)
      : DEFAULT_HORIZON_MS;
    const growthMap = (assumptions.growth ?? {}) as Readonly<Record<string, number>>;

    const projectedEvents: SimulationProjectedEvent[] = [];
    const outcomes: SimulationOutcome[] = [];

    for (const [key, value] of Object.entries(assumedState)) {
      if (isFiniteNumber(value)) {
        const growth = isFiniteNumber(growthMap[key]) ? growthMap[key] : 0;
        const projected = value + value * growth;
        const at = now + horizonMs;
        projectedEvents.push({
          type: "projected-metric",
          at,
          detail: { key, from: value, to: projected, growth },
        });
        outcomes.push({
          metric: key,
          value: projected,
        });
      }
    }

    const sim: TwinSimulation = {
      id: `sim#${entityId}#${scenario}#${now}#${hashSeed(String(seed))}`,
      entityId,
      scenario,
      assumedState,
      projectedEvents,
      outcomes,
      assumptions: [
        {
          name: "horizon",
          description: `Projection horizon of ${horizonMs} ms from the simulation start.`,
        },
        {
          name: "growth",
          description: `Per-key growth factors applied to numeric state values.`,
        },
      ],
      seed,
      ranAt: now,
    };
    const list = this.byEntity.get(entityId) ?? [];
    list.push(sim);
    this.byEntity.set(entityId, list);
    return sim;
  }

  listSimulations(entityId: string): readonly TwinSimulation[] {
    return this.byEntity.get(entityId) ?? [];
  }
}
