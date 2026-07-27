/**
 * @kernel/domain-modeling/sdk/define-state-machine — `defineStateMachine()` DSL.
 *
 * Strongly-typed builder for a `StateMachineDefinition`.
 */

import type { StateMachineDefinition } from "../domain/state-machine";
import type { StateTransition } from "../domain/state-machine";

/** Input to `defineStateMachine()`. */
export interface DefineStateMachineInput {
  readonly id: string;
  readonly name: string;
  readonly states: readonly string[];
  readonly transitions: readonly StateTransition[];
  readonly initial: string;
  readonly terminal: readonly string[];
  readonly description?: string;
}

/** Build a `StateMachineDefinition`. */
export function defineStateMachine(
  input: DefineStateMachineInput
): StateMachineDefinition {
  return {
    id: input.id,
    name: input.name,
    states: input.states,
    transitions: input.transitions,
    initial: input.initial,
    terminal: input.terminal,
    description: input.description,
  };
}

/**
 * Convenience builder for a `StateTransition`. Pure data — kept for
 * ergonomic construction of transitions inline.
 */
export function transition(
  from: string,
  to: string,
  opts?: { readonly guardRuleRef?: string; readonly description?: string }
): StateTransition {
  return {
    from,
    to,
    guardRuleRef: opts?.guardRuleRef,
    description: opts?.description,
  };
}
