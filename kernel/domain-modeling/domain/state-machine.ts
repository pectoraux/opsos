/**
 * @kernel/domain-modeling/domain/state-machine — `StateMachineDefinition` +
 * `StateTransition` + the `canTransitionEntity` pure helper.
 *
 * A state machine is the lifecycle of an EntityType. Each entity instance
 * carries a `state` string; the state machine declares which states are
 * valid, which transitions are allowed between them, and which (optional)
 * guard rule gates each transition.
 *
 * The kernel never learns what "idle → cleaning → done" or
 * "admitted → treated → discharged" means. A domain definition DECLARES
 * these via `StateMachineDefinition`s; the compiler validates runtime
 * `transitionState` calls against them.
 *
 *   `states`      — the closed set of state names. A state name is a plain
 *                   string (no enum narrowing across domains — that would
 *                   hardcode industry vocabulary into the kernel).
 *   `transitions` — the directed edges of the state graph. Each carries
 *                   `from`, `to`, an optional `guardRuleRef` (a knowledge
 *                   Rule id), and a `description`.
 *   `initial`     — the entry state. MUST be in `states`.
 *   `terminal`    — the exit states (may be empty). Each MUST be in `states`.
 *
 * `canTransitionEntity(sm, from, to)` is the pure, deterministic predicate
 * the EntityRegistry uses to validate `transitionState` calls. It returns
 * `true` iff a transition with `from === from && to === to` exists. It does
 * NOT evaluate guard rules — the compiler/policy layer does that.
 *
 * Determinism: pure data + pure function. No `Date.now()`, no `Math.random()`.
 */

/**
 * A single transition in a state machine.
 *
 *   `from`          — the source state. MUST be in the parent
 *                     `StateMachineDefinition.states`.
 *   `to`            — the target state. MUST be in the parent
 *                     `StateMachineDefinition.states`.
 *   `guardRuleRef`  — optional reference to a knowledge Rule id. The
 *                     compiler/policy layer evaluates the rule before
 *                     allowing the transition. The kernel does NOT
 *                     interpret the rule.
 *   `description`   — optional human-readable description.
 */
export interface StateTransition {
  readonly from: string;
  readonly to: string;
  readonly guardRuleRef?: string;
  readonly description?: string;
}

/**
 * The definition of a state machine.
 *
 *   `id`           — unique within the domain. Referenced from
 *                    `EntityType.stateMachineId`.
 *   `name`         — human-readable name.
 *   `states`       — the closed set of state names.
 *   `transitions`  — the directed edges. Each `from` and `to` MUST be in
 *                    `states`.
 *   `initial`      — the entry state. MUST be in `states`.
 *   `terminal`     — the exit states. Each MUST be in `states`. May be empty.
 *   `description`  — optional human-readable description.
 */
export interface StateMachineDefinition {
  readonly id: string;
  readonly name: string;
  readonly states: readonly string[];
  readonly transitions: readonly StateTransition[];
  readonly initial: string;
  readonly terminal: readonly string[];
  readonly description?: string;
}

/**
 * Returns `true` iff the state machine declares a transition from `from`
 * to `to`. Does NOT evaluate guard rules — the compiler/policy layer does
 * that. Returns `false` if `from` or `to` is not a declared state.
 *
 * Pure, deterministic, allocation-light.
 *
 * @param sm   the state machine definition
 * @param from the source state
 * @param to   the target state
 */
export function canTransitionEntity(
  sm: StateMachineDefinition,
  from: string,
  to: string
): boolean {
  // Fast-path: states must be declared.
  if (!sm.states.includes(from)) return false;
  if (!sm.states.includes(to)) return false;
  for (let i = 0; i < sm.transitions.length; i++) {
    const t = sm.transitions[i];
    if (t.from === from && t.to === to) return true;
  }
  return false;
}
