/**
 * @kernel/workflow-runtime/infrastructure/default-step-executor — the reference
 * `StepExecutor` implementation.
 *
 * Interprets every `WorkflowStepType`. The executor is STATEFUL with respect
 * to the instance's `variables`: it reads reserved `__wf.*` keys to distinguish
 * an INITIAL execution from a RESUME (e.g. a `wait` step whose `waitUntil` has
 * been reached). This lets the engine call `executeStep` uniformly for both
 * fresh and resumed steps.
 *
 * Reserved variable keys (per step id):
 *   - `__wf.waitUntil__`     : Record<stepId, number>  — when a wait/timer step may resume.
 *   - `__wf.approved__`      : Record<stepId, boolean> — approval decision (set externally).
 *   - `__wf.childInstances__`: Record<stepId, string>  — subprocess child instance id.
 *   - `__wf.sagas__`         : Record<stepId, SagaInstance> — last saga state.
 *   - `__wf.compensations__` : Array<{ stepId, action }> — recorded compensations.
 *
 * Step-type semantics:
 *   - task:         runs the registered `ActionHandler` (if any); completed/failed.
 *   - wait:         waiting until `now + durationMs`; completed on resume.
 *   - timer:        waiting + schedules a `Timer` (if registry injected); completed on resume.
 *   - approval:     waiting until `__wf.approved__[stepId]` is set; completed/rejected.
 *   - branch:       evaluates `condition`; picks `branches[0]` (then) or `branches[1]` (else).
 *   - parallel:     completed; `__wf.next__` = all `branches` (run concurrently).
 *   - saga:         delegates to `SagaCoordinator`; completed/failed.
 *   - compensation: completed; records the compensation action for later rollback.
 *   - subprocess:   creates a child instance (if registry injected); waiting until child terminates.
 *   - loop:         evaluates `condition`; `branches[0]` (body) or `branches[1]` (exit).
 *   - gate:         evaluates `condition`; completed if true, waiting if false (re-checked on tick).
 *
 * Determinism: pure function of `(step, context)`. No `Date.now()`. Timer ids
 * are derived from `(instanceId, stepId, firesAt)` — deterministic.
 */

import type {
  SagaCoordinator,
  SagaInstance,
  SagaStep,
  StepContext,
  StepExecutor,
  StepResult,
  Timer,
  TimerRegistry,
  WorkflowDefinition,
  WorkflowRegistry,
  WorkflowStep,
} from "../domain";
import type { ActionHandler } from "./default-saga-coordinator";

export interface DefaultStepExecutorDeps {
  readonly taskHandlers?: Map<string, ActionHandler>;
  readonly sagaCoordinator?: SagaCoordinator;
  readonly timerRegistry?: TimerRegistry;
  readonly workflowRegistry?: WorkflowRegistry;
}

export class DefaultStepExecutor implements StepExecutor {
  private readonly taskHandlers: Map<string, ActionHandler>;
  private readonly sagaCoordinator?: SagaCoordinator;
  private readonly timerRegistry?: TimerRegistry;
  private readonly workflowRegistry?: WorkflowRegistry;

  constructor(deps: DefaultStepExecutorDeps = {}) {
    this.taskHandlers = deps.taskHandlers ?? new Map();
    this.sagaCoordinator = deps.sagaCoordinator;
    this.timerRegistry = deps.timerRegistry;
    this.workflowRegistry = deps.workflowRegistry;
  }

  execute(step: WorkflowStep, context: StepContext): StepResult {
    switch (step.type) {
      case "task":
        return this.executeTask(step, context);
      case "wait":
        return this.executeWait(step, context);
      case "timer":
        return this.executeTimer(step, context);
      case "approval":
        return this.executeApproval(step, context);
      case "branch":
        return this.executeBranch(step, context);
      case "parallel":
        return this.executeParallel(step, context);
      case "saga":
        return this.executeSaga(step, context);
      case "compensation":
        return this.executeCompensation(step, context);
      case "subprocess":
        return this.executeSubprocess(step, context);
      case "loop":
        return this.executeLoop(step, context);
      case "gate":
        return this.executeGate(step, context);
      default:
        return {
          status: "failed",
          error: `unknown step type '${(step as { type: string }).type}'`,
        };
    }
  }

  // ── Per-type implementations ────────────────────────────────────────────

  private executeTask(step: WorkflowStep, context: StepContext): StepResult {
    const action = step.config.action ?? step.id;
    const h = this.taskHandlers.get(action);
    if (h) {
      const err = h(action, context, context.now);
      if (err !== null) {
        return { status: "failed", error: err };
      }
    }
    return { status: "completed", output: { lastAction: action } };
  }

  private executeWait(step: WorkflowStep, context: StepContext): StepResult {
    const existing = readWaitUntil(context.variables, context.stepId);
    if (existing !== undefined) {
      return existing <= context.now
        ? { status: "completed" }
        : { status: "waiting", waitUntil: existing };
    }
    const durationMs = step.config.durationMs ?? 0;
    const firesAt = context.now + durationMs;
    return {
      status: "waiting",
      waitUntil: firesAt,
      output: setWaitUntil({}, context.stepId, firesAt),
    };
  }

  private executeTimer(step: WorkflowStep, context: StepContext): StepResult {
    const existing = readWaitUntil(context.variables, context.stepId);
    if (existing !== undefined) {
      return existing <= context.now
        ? { status: "completed" }
        : { status: "waiting", waitUntil: existing };
    }
    const durationMs = step.config.durationMs ?? 0;
    const firesAt = context.now + durationMs;
    // Schedule a Timer (deterministic id) so the registry can cancel/fire it.
    if (this.timerRegistry) {
      const timer: Timer = {
        id: `timer#${context.instanceId}#${context.stepId}#${firesAt}`,
        workflowInstanceId: context.instanceId,
        stepId: context.stepId,
        firesAt,
        status: "pending",
      };
      this.timerRegistry.schedule(timer);
    }
    return {
      status: "waiting",
      waitUntil: firesAt,
      output: setWaitUntil({}, context.stepId, firesAt),
    };
  }

  private executeApproval(step: WorkflowStep, context: StepContext): StepResult {
    const decision = readApproved(context.variables, context.stepId);
    if (decision === true) return { status: "completed" };
    if (decision === false) {
      return { status: "failed", error: "approval rejected" };
    }
    return { status: "waiting" };
  }

  private executeBranch(step: WorkflowStep, context: StepContext): StepResult {
    const cond = evaluateCondition(step.config.condition ?? "true", context.variables);
    const branches = step.config.branches ?? [];
    const next = cond
      ? branches.length > 0
        ? [branches[0]]
        : []
      : branches.length > 1
        ? [branches[1]]
        : [];
    return { status: "completed", output: { "__wf.next__": next } };
  }

  private executeParallel(step: WorkflowStep, context: StepContext): StepResult {
    const branches = step.config.branches ?? [];
    return { status: "completed", output: { "__wf.next__": [...branches] } };
  }

  private executeSaga(step: WorkflowStep, context: StepContext): StepResult {
    if (!this.sagaCoordinator) {
      // No coordinator — saga is a structural no-op in the deterministic core.
      return { status: "completed" };
    }
    const sagaSteps = parseSagaSteps(step.config.branches ?? []);
    const existing = readSaga(context.variables, context.stepId);
    const saga: SagaInstance =
      existing ?? {
        id: `saga#${context.instanceId}#${context.stepId}`,
        steps: sagaSteps,
        completedSteps: [],
        status: "running",
      };
    const result = this.sagaCoordinator.execute(saga, context, context.now);
    const output = setSaga({}, context.stepId, result);
    if (result.status === "completed") {
      return { status: "completed", output };
    }
    return {
      status: "failed",
      error: result.error ?? `saga ended in status '${result.status}'`,
      output,
    };
  }

  private executeCompensation(
    step: WorkflowStep,
    context: StepContext
  ): StepResult {
    const action = step.config.action ?? step.id;
    const existing = readCompensations(context.variables);
    const entry = { stepId: context.stepId, action };
    return {
      status: "completed",
      output: { "__wf.compensations__": [...existing, entry] },
    };
  }

  private executeSubprocess(
    step: WorkflowStep,
    context: StepContext
  ): StepResult {
    const childId = readChildInstance(context.variables, context.stepId);
    if (childId === undefined) {
      // Initial: create + start the child instance.
      if (!this.workflowRegistry) {
        return {
          status: "failed",
          error: "subprocess step requires a WorkflowRegistry",
        };
      }
      const subprocessId = step.config.subprocessId;
      if (!subprocessId) {
        return { status: "failed", error: "subprocess step missing subprocessId" };
      }
      const child = this.workflowRegistry.createInstance(
        subprocessId,
        step.config.variables ?? {},
        context.now
      );
      const def = this.workflowRegistry.getDefinition(
        subprocessId,
        child.definitionVersion
      );
      const entry = def ? computeEntrySteps(def) : [];
      const started: import("../domain").WorkflowInstance = {
        ...child,
        status: entry.length === 0 ? "completed" : "running",
        currentSteps: entry,
        completedAt: entry.length === 0 ? context.now : undefined,
        history:
          entry.length === 0
            ? [
                ...child.history,
                { stepId: "", type: "started" as const, timestamp: context.now },
                {
                  stepId: "",
                  type: "completed" as const,
                  timestamp: context.now,
                },
              ]
            : [
                ...child.history,
                {
                  stepId: entry[0] ?? "",
                  type: "started" as const,
                  timestamp: context.now,
                },
              ],
      };
      this.workflowRegistry.updateInstance(started);
      return {
        status: "waiting",
        output: setChildInstance({}, context.stepId, started.id),
      };
    }
    // Resume: check child status.
    if (!this.workflowRegistry) {
      return { status: "failed", error: "subprocess step requires a WorkflowRegistry" };
    }
    const child = this.workflowRegistry.getInstance(childId);
    if (!child) {
      return { status: "failed", error: `subprocess '${childId}' not found` };
    }
    if (child.status === "completed") {
      return {
        status: "completed",
        output: { "__wf.childResult__": child.variables },
      };
    }
    if (
      child.status === "failed" ||
      child.status === "cancelled" ||
      child.status === "timed-out"
    ) {
      return {
        status: "failed",
        error: `subprocess '${childId}' ended in status '${child.status}'`,
      };
    }
    return { status: "waiting" };
  }

  private executeLoop(step: WorkflowStep, context: StepContext): StepResult {
    const cond = evaluateCondition(step.config.condition ?? "true", context.variables);
    const branches = step.config.branches ?? [];
    // branches[0] = body, branches[1] = exit (fall back to step.next / []).
    const next = cond
      ? branches.length > 0
        ? [branches[0]]
        : [...step.next]
      : branches.length > 1
        ? [branches[1]]
        : [];
    return { status: "completed", output: { "__wf.next__": next } };
  }

  private executeGate(step: WorkflowStep, context: StepContext): StepResult {
    const cond = evaluateCondition(step.config.condition ?? "true", context.variables);
    return cond ? { status: "completed" } : { status: "waiting" };
  }
}

// ── Reserved-key helpers (pure) ─────────────────────────────────────────────

function readWaitUntil(
  variables: Readonly<Record<string, unknown>>,
  stepId: string
): number | undefined {
  const map = variables["__wf.waitUntil__"] as
    | Record<string, number>
    | undefined;
  return map?.[stepId];
}

function setWaitUntil(
  output: Record<string, unknown>,
  stepId: string,
  firesAt: number
): Record<string, unknown> {
  return { ...output, "__wf.waitUntil__": { [stepId]: firesAt } };
}

function readApproved(
  variables: Readonly<Record<string, unknown>>,
  stepId: string
): boolean | undefined {
  const map = variables["__wf.approved__"] as
    | Record<string, boolean>
    | undefined;
  return map?.[stepId];
}

function readChildInstance(
  variables: Readonly<Record<string, unknown>>,
  stepId: string
): string | undefined {
  const map = variables["__wf.childInstances__"] as
    | Record<string, string>
    | undefined;
  return map?.[stepId];
}

function setChildInstance(
  output: Record<string, unknown>,
  stepId: string,
  childId: string
): Record<string, unknown> {
  return { ...output, "__wf.childInstances__": { [stepId]: childId } };
}

function readSaga(
  variables: Readonly<Record<string, unknown>>,
  stepId: string
): SagaInstance | undefined {
  const map = variables["__wf.sagas__"] as
    | Record<string, SagaInstance>
    | undefined;
  return map?.[stepId];
}

function setSaga(
  output: Record<string, unknown>,
  stepId: string,
  saga: SagaInstance
): Record<string, unknown> {
  return { ...output, "__wf.sagas__": { [stepId]: saga } };
}

function readCompensations(
  variables: Readonly<Record<string, unknown>>
): ReadonlyArray<{ stepId: string; action: string }> {
  const list = variables["__wf.compensations__"] as
    | ReadonlyArray<{ stepId: string; action: string }>
    | undefined;
  return list ?? [];
}

function parseSagaSteps(branches: readonly string[]): SagaStep[] {
  return branches.map((entry, idx) => {
    const colonIdx = entry.indexOf(":");
    if (colonIdx >= 0) {
      const action = entry.slice(0, colonIdx);
      const compensation = entry.slice(colonIdx + 1);
      return { id: action, action, compensation };
    }
    return {
      id: entry,
      action: entry,
      compensation: `${entry}.compensate`,
    };
  });
}

function computeEntrySteps(
  def: WorkflowDefinition
): readonly string[] {
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

// ── Condition evaluator (minimal, safe, deterministic) ─────────────────────
//
// Grammar:
//   expr   := or
//   or     := and ('||' and)*
//   and    := not ('&&' not)*
//   not    := '!' not | cmp
//   cmp    := atom (('==' | '!=' | '>=' | '<=' | '>' | '<') atom)?
//   atom   := number | 'true' | 'false' | string | identifier | '(' expr ')'
//
// Identifiers may contain dots (e.g. `foo.bar.baz`) and are resolved against
// the variables bag by nested key lookup. Unknown identifiers resolve to
// `undefined`. Comparisons coerce numerically when both sides look numeric.

/** Evaluate a boolean condition expression against a variables bag. */
export function evaluateCondition(
  condition: string,
  variables: Readonly<Record<string, unknown>>
): boolean {
  const tokens = tokenize(condition);
  const parser = new Parser(tokens, variables);
  const result = parser.parseExpr();
  if (parser.pos < tokens.length) {
    throw new Error(
      `unexpected token '${tokens[parser.pos]}' in condition '${condition}'`
    );
  }
  return toBoolean(result);
}

type Token =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let value = "";
      while (i < src.length && src[i] !== quote) {
        value += src[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push({ kind: "str", value });
      continue;
    }
    if (isDigit(ch) || (ch === "-" && isDigit(src[i + 1]))) {
      let num = "";
      if (ch === "-") {
        num += "-";
        i++;
      }
      while (i < src.length && (isDigit(src[i]) || src[i] === ".")) {
        num += src[i];
        i++;
      }
      tokens.push({ kind: "num", value: parseFloat(num) });
      continue;
    }
    if (isIdentStart(ch)) {
      let ident = "";
      while (i < src.length && isIdentPart(src[i])) {
        ident += src[i];
        i++;
      }
      if (ident === "true") {
        tokens.push({ kind: "str", value: "true" });
      } else if (ident === "false") {
        tokens.push({ kind: "str", value: "false" });
      } else if (ident === "null") {
        tokens.push({ kind: "str", value: "null" });
      } else if (ident === "undefined") {
        tokens.push({ kind: "str", value: "undefined" });
      } else {
        tokens.push({ kind: "ident", value: ident });
      }
      continue;
    }
    // Operators: &&, ||, ==, !=, >=, <=, >, <, !
    const two = src.slice(i, i + 2);
    if (two === "&&" || two === "||" || two === "==" || two === "!=" || two === ">=" || two === "<=") {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }
    if (ch === ">" || ch === "<" || ch === "!") {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    throw new Error(`unexpected character '${ch}' in condition '${src}'`);
  }
  return tokens;
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}
function isIdentStart(ch: string): boolean {
  return /[a-zA-Z_$]/.test(ch);
}
function isIdentPart(ch: string): boolean {
  return /[a-zA-Z0-9_.$]/.test(ch);
}

class Parser {
  pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly variables: Readonly<Record<string, unknown>>
  ) {}

  parseExpr(): unknown {
    return this.parseOr();
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peekOp("||")) {
      this.pos++;
      const right = this.parseAnd();
      left = toBoolean(left) || toBoolean(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseNot();
    while (this.peekOp("&&")) {
      this.pos++;
      const right = this.parseNot();
      left = toBoolean(left) && toBoolean(right);
    }
    return left;
  }

  private parseNot(): unknown {
    if (this.peekOp("!")) {
      this.pos++;
      return !toBoolean(this.parseNot());
    }
    return this.parseCmp();
  }

  private parseCmp(): unknown {
    const left = this.parseAtom();
    const op = this.peekCmpOp();
    if (op) {
      this.pos++;
      const right = this.parseAtom();
      return compare(left, op, right);
    }
    return left;
  }

  private parseAtom(): unknown {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("unexpected end of condition");
    if (t.kind === "num") {
      this.pos++;
      return t.value;
    }
    if (t.kind === "str") {
      this.pos++;
      if (t.value === "true") return true;
      if (t.value === "false") return false;
      if (t.value === "null") return null;
      if (t.value === "undefined") return undefined;
      return t.value;
    }
    if (t.kind === "ident") {
      this.pos++;
      return resolveIdent(t.value, this.variables);
    }
    if (t.kind === "lparen") {
      this.pos++;
      const v = this.parseExpr();
      const next = this.tokens[this.pos];
      if (!next || next.kind !== "rparen") {
        throw new Error("expected ')'");
      }
      this.pos++;
      return v;
    }
    throw new Error(`unexpected token in atom`);
  }

  private peekOp(value: string): boolean {
    const t = this.tokens[this.pos];
    return t !== undefined && t.kind === "op" && t.value === value;
  }

  private peekCmpOp(): string | undefined {
    const t = this.tokens[this.pos];
    if (
      t !== undefined &&
      t.kind === "op" &&
      (t.value === "==" ||
        t.value === "!=" ||
        t.value === ">" ||
        t.value === "<" ||
        t.value === ">=" ||
        t.value === "<=")
    ) {
      return t.value;
    }
    return undefined;
  }
}

function resolveIdent(
  name: string,
  variables: Readonly<Record<string, unknown>>
): unknown {
  const parts = name.split(".");
  let current: unknown = variables;
  for (const p of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

function toBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (v === null || v === undefined) return false;
  return Boolean(v);
}

function compare(left: unknown, op: string, right: unknown): boolean {
  // Numeric coercion when both sides look numeric.
  const ln = typeof left === "number" ? left : Number(left);
  const rn = typeof right === "number" ? right : Number(right);
  const bothNumeric =
    (typeof left === "number" || (typeof left === "string" && left.trim() !== "" && !isNaN(ln))) &&
    (typeof right === "number" || (typeof right === "string" && right.trim() !== "" && !isNaN(rn)));

  switch (op) {
    case "==":
      return bothNumeric ? ln === rn : left === right;
    case "!=":
      return bothNumeric ? ln !== rn : left !== right;
    case ">":
      return bothNumeric ? ln > rn : false;
    case "<":
      return bothNumeric ? ln < rn : false;
    case ">=":
      return bothNumeric ? ln >= rn : false;
    case "<=":
      return bothNumeric ? ln <= rn : false;
    default:
      return false;
  }
}
