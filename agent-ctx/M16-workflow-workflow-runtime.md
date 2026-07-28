# M16-workflow — workflow-runtime agent work record

## Task
Build the Workflow Runtime kernel module (Milestone 16) under
`/home/z/my-project/kernel/workflow-runtime/` — BPMN-like long-running workflow
execution with waiting, retries, timers, approvals, compensation, saga
orchestration, and recurring jobs.

## Context read before starting
- `/home/z/my-project/worklog.md` (M1-M15, all frozen).
- `/home/z/my-project/kernel/shared-kernel/interfaces/index.ts` → re-exports
  domain barrel: Result/Option, KernelError hierarchy, branded IDs,
  versioning/temporal, RuntimeClock/RandomSource ports, 16 primitives.
- Surveyed `kernel/coordination/` as the structural reference (domain ports →
  application use-cases → infrastructure in-memory impls + bundle helper).

## Files created (22)
- domain/ (8): workflow-definition, workflow-instance, step-executor, saga,
  timer, recurring-job, workflow-registry, index.
- application/ (5): start-workflow, resume-workflow, cancel-workflow,
  execute-saga, index.
- infrastructure/ (7): default-step-executor, default-saga-coordinator,
  in-memory-timer-registry, in-memory-recurring-scheduler,
  in-memory-workflow-registry, default-workflow-engine, index.
- interfaces/index.ts, index.ts (root).

## Public surface (`@kernel/workflow-runtime`)
- Domain: WorkflowDefinition, WorkflowStep, WorkflowStepType, StepConfig,
  WorkflowTrigger, WorkflowTriggerKind, ErrorHandlingStrategy; WorkflowInstance,
  WorkflowInstanceStatus, WorkflowEvent, WorkflowEventType, WorkflowEngine;
  StepContext, StepResult, StepResultStatus, StepExecutor; SagaStep, SagaInstance,
  SagaStatus, SagaCoordinator; Timer, TimerStatus, TimerRegistry; RecurringJob,
  RecurringJobStatus, RecurringSchedule, CronExpression, IntervalMs,
  RecurringJobScheduler; InstanceFilter, WorkflowRegistry.
- Application: StartWorkflow/StartWorkflowUseCase, ResumeWorkflow/
  ResumeWorkflowUseCase, CancelWorkflow/CancelWorkflowUseCase, ExecuteSaga/
  ExecuteSagaUseCase.
- Infrastructure: InMemoryWorkflowRegistry, InMemoryTimerRegistry,
  InMemoryRecurringJobScheduler, DefaultStepExecutor (+DefaultStepExecutorDeps,
  evaluateCondition), DefaultSagaCoordinator (+ActionHandler),
  DefaultWorkflowEngine (+DefaultWorkflowEngineDeps), WorkflowRuntime,
  createWorkflowRuntime.

## Key design decisions
- StepExecutor is STATEFUL w.r.t. instance `variables` via reserved `__wf.*`
  keys (waitUntil/approved/childInstances/sagas/compensations) so the engine
  can call `executeStep` uniformly for fresh + resumed steps.
- Engine handles orchestration only: timer scheduling/firing, recurring job
  spawning, running-instance step execution, waiting-instance resume checks
  (per step type), per-step timeouts, retry backoff, compensation rollback.
- No-op guard in processStepResult prevents duplicate `waiting` events on gate
  re-evaluation.
- Minimal safe recursive-descent condition evaluator (no eval/Function):
  numbers, strings, booleans, dotted identifiers, ==/!=/>/</>=/<=, &&/||/!.
- Minimal 5-field cron parser with traditional dom/dow OR semantics;
  nextCronTime scans minute-by-minute capped at 1 year.
- Saga steps encode sub-steps as `config.branches` entries `"action:compensation"`
  (compensation defaults to `action.compensate`).

## Determinism
No `Date.now()` / `Math.random()` anywhere. All time via `now`. Instance/timer
ids derived from `(definitionId, now, counter)`. Cron expansion uses
`new Date(ms).getUTC*()` (pure function of epoch-ms).

## Verification (final)
- `bunx tsc --noEmit 2>&1 | grep "workflow-runtime"` → empty.
- `bunx tsc --noEmit 2>&1 | grep -v "skills/" | head` → empty.

## Issues encountered & fixed
1. `*/N` sequences inside JSDoc block comments prematurely terminated the
   comments → reworded to avoid the `*/` literal.
2. `WorkflowEngine` port was missing from domain → added to
   workflow-instance.ts and exported via the domain barrel.
3. Subprocess child-instance object literal inferred `status: string` → typed
   explicitly as `WorkflowInstance` to narrow the union.
