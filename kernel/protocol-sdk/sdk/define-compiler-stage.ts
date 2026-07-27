/**
 * @kernel/protocol-sdk/sdk/define-compiler-stage — `defineCompilerStage()` DSL.
 *
 * Declares a protocol-provided compiler stage. Per ADR-0011 + the SDK spec,
 * NO stage may REPLACE kernel stages — the name must NOT start with `kernel.`.
 * The registry enforces this at registration time.
 */

import type { CompilerPhase } from "@kernel/compiler";
import type { ProtocolCompilerStage, InsertionPolicy } from "../compiler/compiler-extension-registry";
import type { SemverString } from "../manifest/protocol-manifest";

export interface DefineCompilerStageInput {
  readonly name: string;
  readonly version: SemverString;
  readonly phase: CompilerPhase;
  readonly order: number;
  readonly insertion: InsertionPolicy;
  readonly dependsOn?: readonly string[];
  /** Reference to the actual CompilerStage implementation (resolved by pipeline). */
  readonly stageRef: string;
  readonly description?: string;
}

export function defineCompilerStage(input: DefineCompilerStageInput): Omit<ProtocolCompilerStage, "ownerProtocolId"> {
  if (input.name.startsWith("kernel.")) {
    throw new Error(
      `defineCompilerStage: name '${input.name}' must not start with 'kernel.' — protocols extend kernel stages, never replace them`
    );
  }
  return {
    name: input.name,
    version: input.version,
    phase: input.phase,
    order: input.order,
    insertion: input.insertion,
    dependsOn: input.dependsOn ?? [],
    stageRef: input.stageRef,
    description: input.description,
  };
}
