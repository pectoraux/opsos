/**
 * @kernel/governance/application/get-evolution-history — use-case: get the
 * full evolution history for an artifact.
 *
 * Pure delegation to the registry's `getEvolutionHistory`. Exists as a
 * distinct use-case so callers compose governance operations through a
 * consistent application-layer surface (rather than calling the registry
 * directly from the edges).
 *
 * Deterministic given its inputs.
 */

import type { EvolutionHistory } from "../domain/evolution-history";
import type { GovernanceRegistry } from "../domain/governance-registry";

/** Dependencies injected into the use-case. */
export interface GetEvolutionHistoryDeps {
  readonly registry: GovernanceRegistry;
}

/** Input to the use-case. */
export interface GetEvolutionHistoryInput {
  /** The artifact id whose history to retrieve. */
  readonly artifactId: string;
}

/**
 * Get the full evolution history for an artifact. Returns `undefined` if no
 * versions of the artifact are registered.
 */
export function getEvolutionHistory(
  deps: GetEvolutionHistoryDeps,
  input: GetEvolutionHistoryInput
): EvolutionHistory | undefined {
  return deps.registry.getEvolutionHistory(input.artifactId);
}

/**
 * Use-case class wrapping `getEvolutionHistory` for callers that prefer an OO
 * style. Stateless aside from its injected deps.
 */
export class GetEvolutionHistory {
  constructor(private readonly deps: GetEvolutionHistoryDeps) {}

  run(input: GetEvolutionHistoryInput): EvolutionHistory | undefined {
    return getEvolutionHistory(this.deps, input);
  }
}
