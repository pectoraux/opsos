/**
 * @kernel/workflow-runtime/infrastructure/default-workflow-engine — the
 * reference `WorkflowEngine` implementation.
 *
 * Orchestrates step execution, waiting/timer/retry/timeout handling, recurring
 * job spawning, and subprocess completion propagation. The engine is the only
 * component that mutates instance state (via `WorkflowRegistry.updateInstance`);
 * the `StepExecutor` is a pure evaluator.
 *
 * Two public methods:
 *   - `executeStep(instanceId, stepId, now)` — execute (or resume) a single
 *     step. Fresh execution when the instance is `running`; resume when
 *     `waiting` (the executor reads reserved `__wf.*` keys to distinguish).
 *   - `tick(now)` — fire due timers, spawn due recurring jobs, execute running
 *     instances' current steps, and resume waiting instances whose resume
 *     condition is met. Returns the list of instances touched this tick.
 *
 * Reserved variable keys (managed by the engine):
 *   - `__wf.waitUntil__`      : Record<stepId, number>
 *   - `__wf.retries__`        : Record<stepId, number>
 *   - `__wf.stepStartedAt__`  : Record<stepId, number>
 *   - `__wf.approved__`       : Record<stepId, boolean>  (set externally via ResumeWorkflow)
 *   - `__wf.childInstances__` : Record<stepId, string>
 *   - `__wf.sagas__`          : Record<stepId, SagaInstance>
 *   - `__wf.compensations__`  : Array<{ stepId, action }>
 *
 * Determinism: pure function of `(registry state, now)`. No `Date.now()`, no
 * `Math.random()`. Instance/timer ids are deterministic.
 */

import { IllegalStateError, NotFoundError } from "@kernel/shared-kernel";

import type {
  RecurringJobScheduler,
  StepExecutor,
  SagaCoordinator,
  TimerRegistry,
  WorkflowDefinition,
  WorkflowEngine,
  WorkflowInstance,
  WorkflowStep,
} from "../domain";

export interface DefaultWorkflowEngineDeps {
  readonly registry: import("../domain").WorkflowRegistry;
  readonly stepExecutor: StepExecutor;
  readonly sagaCoordinator?: SagaCoordinator;
  readonly timerRegistry?: TimerRegistry;
  readonly recurringScheduler?: RecurringJobScheduler;
}

const WAIT_UNTIL = "__wf.waitUntil__";
const RETRIES = "__wf.retries__";
const STEP_STARTED_AT = "__wf.stepStartedAt__";
const APPROVED = "__wf.approved__";
const CHILD_INSTANCES = "__wf.childInstances__";
const NEXT_OVERRIDE = "__wf.next__";

export class DefaultWorkflowEngine implements WorkflowEngine {
  private readonly registry: import("../domain").WorkflowRegistry;
  private readonly stepExecutor: StepExecutor;
  private readonly timerRegistry?: TimerRegistry;
  private readonly recurringScheduler?: RecurringJobScheduler;

  constructor(deps: DefaultWorkflowEngineDeps) {
    this.registry = deps.registry;
    this.stepExecutor = deps.stepExecutor;
    this.timerRegistry = deps.timerRegistry;
    this.recurringScheduler = deps.recurringScheduler;
  }

  // ── executeStep ──────────────────────────────────────────────────────────

  executeStep(instanceId: string, stepId: string, now: number): WorkflowInstance {
    const inst = this.registry.getInstance(instanceId);
    if (!inst) {
      throw new NotFoundError("WorkflowInstance", instanceId);
    }
    if (inst.status !== "running" && inst.status !== "waiting") {
      throw new IllegalStateError(
        `Cannot execute step '${stepId}' on instance '${instanceId}' in status '${inst.status}'`
      );
    }
    if (!inst.currentSteps.includes(stepId)) {
      throw new IllegalStateError(
        `Step '${stepId}' is not active on instance '${instanceId}' (currentSteps: [${inst.currentSteps.join(", ")}])`
      );
    }
    const def = this.registry.getDefinition(inst.definitionId, inst.definitionVersion);
    if (!def) {
      throw new NotFoundError("WorkflowDefinition", inst.definitionId);
    }
    const step = def.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundError("WorkflowStep", stepId);
    }

    const result = this.stepExecutor.execute(step, {
      instanceId,
      stepId,
      variables: inst.variables,
      now,
    });

    const updated = this.processStepResult(inst, def, step, result, now);
    this.registry.updateInstance(updated);
    return updated;
  }

  // ── tick ─────────────────────────────────────────────────────────────────

  tick(now: number): readonly WorkflowInstance[] {
    const touched: WorkflowInstance[] = [];
    const touchedIds = new Set<string>();

    const add = (inst: WorkflowInstance | undefined) => {
      if (inst && !touchedIds.has(inst.id)) {
        touchedIds.add(inst.id);
        touched.push(inst);
      }
    };

    // 1. Fire due timers → resume bound steps.
    if (this.timerRegistry) {
      for (const timer of this.timerRegistry.getDue(now)) {
        this.timerRegistry.fire(timer.id, now);
        const inst = this.registry.getInstance(timer.workflowInstanceId);
        if (
          inst &&
          inst.status === "waiting" &&
          inst.currentSteps.includes(timer.stepId)
        ) {
          add(this.executeStep(inst.id, timer.stepId, now));
        }
      }
    }

    // 2. Spawn due recurring jobs.
    if (this.recurringScheduler) {
      for (const job of this.recurringScheduler.getDue(now)) {
        const spawned = this.spawnInstance(
          job.workflowDefinitionId,
          job.variables ?? {},
          now
        );
        this.recurringScheduler.markRun(job.id, now);
        add(spawned);
      }
    }

    // 3. Running instances: execute their current steps (fresh execution).
    for (const inst of this.registry.listInstances({ status: "running" })) {
      let current = inst;
      for (const stepId of [...current.currentSteps]) {
        if (current.status !== "running") break;
        if (!current.currentSteps.includes(stepId)) continue;
        const result = this.executeStep(current.id, stepId, now);
        add(result);
        current = result;
      }
    }

    // 4. Waiting instances: check resume conditions per step type.
    for (const inst of this.registry.listInstances({ status: "waiting" })) {
      if (inst.status !== "waiting") continue;
      const def = this.registry.getDefinition(
        inst.definitionId,
        inst.definitionVersion
      );
      if (!def) continue;
      for (const stepId of [...inst.currentSteps]) {
        const step = def.steps.find((s) => s.id === stepId);
        if (!step) continue;

        // Timeout check.
        const startedAt = readMap(inst.variables, STEP_STARTED_AT, stepId);
        if (
          step.timeoutMs !== undefined &&
          startedAt !== undefined &&
          now - startedAt > step.timeoutMs
        ) {
          add(this.applyTimeout(inst, step, now));
          break;
        }

        const ready = this.isReadyToResume(inst, step, now);
        if (ready) {
          const result = this.executeStep(inst.id, stepId, now);
          // Only count as touched if something changed (avoids gate-re-eval noise).
          if (
            result.status !== inst.status ||
            result.history.length !== inst.history.length ||
            result.currentSteps.length !== inst.currentSteps.length
          ) {
            add(result);
          }
          break;
        }
      }
    }

    return touched;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /** Decide whether a waiting step is ready to be re-executed (resumed). */
  private isReadyToResume(
    inst: WorkflowInstance,
    step: WorkflowStep,
    now: number
  ): boolean {
    switch (step.type) {
      case "wait":
      case "timer": {
        const wu = readMap(inst.variables, WAIT_UNTIL, step.id);
        return wu !== undefined && wu <= now;
      }
      case "gate":
        // Re-evaluate every tick (cheap; the executor returns waiting if false).
        return true;
      case "subprocess": {
        const childId = readMap(inst.variables, CHILD_INSTANCES, step.id) as
          | string
          | undefined;
        if (!childId) return false;
        const child = this.registry.getInstance(childId);
        if (!child) return false;
        return (
          child.status === "completed" ||
          child.status === "failed" ||
          child.status === "cancelled" ||
          child.status === "timed-out"
        );
      }
      case "approval":
        // External resume only (via ResumeWorkflow → status running → executeStep).
        return false;
      default:
        return false;
    }
  }

  /** Mark a waiting step as timed-out and terminate the instance. */
  private applyTimeout(
    inst: WorkflowInstance,
    step: WorkflowStep,
    now: number
  ): WorkflowInstance {
    const variables = clearStepState(inst.variables, step.id);
    const updated: WorkflowInstance = {
      ...inst,
      variables,
      status: "timed-out",
      currentSteps: [],
      completedAt: now,
      error: `step '${step.id}' timed out`,
      history: [
        ...inst.history,
        { stepId: step.id, type: "timed-out", timestamp: now },
      ],
    };
    this.registry.updateInstance(updated);
    return updated;
  }

  /** Spawn a fresh running instance of a definition (used by recurring jobs). */
  private spawnInstance(
    definitionId: string,
    variables: Readonly<Record<string, unknown>>,
    now: number
  ): WorkflowInstance {
    const def = this.registry.getDefinition(definitionId);
    if (!def) {
      throw new NotFoundError("WorkflowDefinition", definitionId);
    }
    const pending = this.registry.createInstance(definitionId, variables, now);
    const entry = computeEntrySteps(def);
    const started: WorkflowInstance =
      entry.length === 0
        ? {
            ...pending,
            status: "completed",
            currentSteps: [],
            completedAt: now,
            history: [
              ...pending.history,
              { stepId: "", type: "started", timestamp: now },
              { stepId: "", type: "completed", timestamp: now },
            ],
          }
        : {
            ...pending,
            status: "running",
            currentSteps: entry,
            history: [
              ...pending.history,
              { stepId: entry[0], type: "started", timestamp: now },
            ],
          };
    this.registry.updateInstance(started);
    return started;
  }

  /** Process a `StepResult` and produce the next instance state. */
  private processStepResult(
    inst: WorkflowInstance,
    def: WorkflowDefinition,
    step: WorkflowStep,
    result: ReturnType<StepExecutor["execute"]>,
    now: number
  ): WorkflowInstance {
    // No-op: step already waiting and still waiting (e.g. gate re-eval false).
    if (
      result.status === "waiting" &&
      inst.status === "waiting" &&
      inst.currentSteps.includes(step.id)
    ) {
      return inst;
    }

    let variables = inst.variables;
    if (result.output) {
      variables = mergeVariables(variables, result.output);
    }
    let history = inst.history;
    let currentSteps = inst.currentSteps;
    let status = inst.status;
    let completedAt = inst.completedAt;
    let error = inst.error;

    switch (result.status) {
      case "completed": {
        history = [
          ...history,
          { stepId: step.id, type: "completed", timestamp: now },
        ];
        variables = clearStepState(variables, step.id);
        const nextOverride = (result.output?.[NEXT_OVERRIDE] ?? undefined) as
          | readonly string[]
          | undefined;
        const next = Array.isArray(nextOverride) ? nextOverride : step.next;
        currentSteps = advanceCurrentSteps(currentSteps, step.id, next);
        if (currentSteps.length === 0) {
          status = "completed";
          completedAt = now;
          history = [
            ...history,
            { stepId: "", type: "completed", timestamp: now },
          ];
        } else {
          status = "running";
        }
        break;
      }
      case "failed": {
        history = [
          ...history,
          {
            stepId: step.id,
            type: "failed",
            timestamp: now,
            data: { error: result.error },
          },
        ];
        const strategy = def.errorHandling;

        if (strategy === "retry") {
          const retries = readMap(variables, RETRIES, step.id) ?? 0;
          const max = step.config.maxRetries ?? 0;
          if (retries < max) {
            variables = writeMap(variables, RETRIES, step.id, retries + 1);
            const delay = step.config.retryDelayMs ?? 0;
            variables = writeMap(variables, WAIT_UNTIL, step.id, now + delay);
            variables = writeMap(variables, STEP_STARTED_AT, step.id, now);
            history = [
              ...history,
              {
                stepId: step.id,
                type: "waiting",
                timestamp: now,
                data: { retry: retries + 1 },
              },
            ];
            status = "waiting";
            currentSteps = ensureStepPresent(currentSteps, step.id);
            break;
          }
        } else if (strategy === "continue") {
          variables = clearStepState(variables, step.id);
          currentSteps = advanceCurrentSteps(currentSteps, step.id, step.next);
          if (currentSteps.length === 0) {
            status = "completed";
            completedAt = now;
          } else {
            status = "running";
          }
          break;
        } else if (strategy === "compensate") {
          const compensations = readCompensations(variables);
          for (const c of [...compensations].reverse()) {
            history = [
              ...history,
              {
                stepId: c.stepId,
                type: "compensated",
                timestamp: now,
                data: { action: c.action },
              },
            ];
          }
        }
        // "stop" | "escalate" | retry-exhausted | compensate-done → terminal.
        status = "failed";
        completedAt = now;
        error = result.error;
        currentSteps = [];
        break;
      }
      case "waiting": {
        history = [
          ...history,
          { stepId: step.id, type: "waiting", timestamp: now },
        ];
        status = "waiting";
        variables = writeMap(variables, STEP_STARTED_AT, step.id, now);
        if (result.waitUntil !== undefined) {
          variables = writeMap(variables, WAIT_UNTIL, step.id, result.waitUntil);
        }
        currentSteps = ensureStepPresent(currentSteps, step.id);
        break;
      }
      case "timed-out": {
        history = [
          ...history,
          { stepId: step.id, type: "timed-out", timestamp: now },
        ];
        variables = clearStepState(variables, step.id);
        status = "timed-out";
        completedAt = now;
        error = result.error ?? `step '${step.id}' timed out`;
        currentSteps = [];
        break;
      }
    }

    return {
      ...inst,
      variables,
      history,
      currentSteps,
      status,
      completedAt,
      error,
    };
  }
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function computeEntrySteps(def: WorkflowDefinition): readonly string[] {
  const referenced = new Set<string>();
  for (const s of def.steps) {
    for (const n of s.next) referenced.add(n);
  }
  const entry = def.steps
    .filter((s) => !referenced.has(s.id))
    .map((s) => s.id);
  if (entry.length === 0 && def.steps.length > 0) {
    return [def.steps[0].id];
  }
  return entry;
}

function advanceCurrentSteps(
  current: readonly string[],
  stepId: string,
  next: readonly string[]
): readonly string[] {
  const remaining = current.filter((s) => s !== stepId);
  const added = next.filter((n) => !remaining.includes(n));
  return [...remaining, ...added];
}

function ensureStepPresent(
  current: readonly string[],
  stepId: string
): readonly string[] {
  return current.includes(stepId) ? current : [...current, stepId];
}

function mergeVariables(
  base: Readonly<Record<string, unknown>>,
  output: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(output)) {
    const bv = result[k];
    if (
      k.startsWith("__wf.") &&
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      bv !== null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      result[k] = {
        ...(bv as Record<string, unknown>),
        ...(v as Record<string, unknown>),
      };
    } else {
      result[k] = v;
    }
  }
  return result;
}

function readMap(
  variables: Readonly<Record<string, unknown>>,
  key: string,
  stepId: string
): number | undefined {
  const map = variables[key] as Record<string, number> | undefined;
  return map?.[stepId];
}

function writeMap(
  variables: Readonly<Record<string, unknown>>,
  key: string,
  stepId: string,
  value: number
): Record<string, unknown> {
  const map = (variables[key] as Record<string, number> | undefined) ?? {};
  return { ...variables, [key]: { ...map, [stepId]: value } };
}

function clearStepState(
  variables: Readonly<Record<string, unknown>>,
  stepId: string
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...variables };
  for (const key of [WAIT_UNTIL, RETRIES, STEP_STARTED_AT, APPROVED, CHILD_INSTANCES]) {
    const map = result[key] as Record<string, unknown> | undefined;
    if (map && stepId in map) {
      const { [stepId]: _omit, ...rest } = map;
      result[key] = rest;
    }
  }
  return result;
}

function readCompensations(
  variables: Readonly<Record<string, unknown>>
): ReadonlyArray<{ stepId: string; action: string }> {
  const list = variables["__wf.compensations__"] as
    | ReadonlyArray<{ stepId: string; action: string }>
    | undefined;
  return list ?? [];
}
