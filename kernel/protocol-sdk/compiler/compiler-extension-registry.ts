/**
 * @kernel/protocol-sdk/compiler — the CompilerExtensionRegistry.
 *
 * Protocols insert compiler stages into the pipeline. Per ADR-0011 + the SDK
 * spec: NO stage may REPLACE kernel stages — protocols only EXTEND them. The
 * registry enforces this by rejecting stage names with the `kernel.` prefix.
 *
 * A `ProtocolCompilerStage` is a descriptor: the actual `CompilerStage`
 * implementation is resolved at compile time by the pipeline (the descriptor
 * carries a `stageRef` the pipeline looks up). This keeps the registry pure
 * data (no JS functions stored), so it is serialisable and replayable.
 */

import type { CompilerPhase } from "@kernel/compiler";
import type { SemverString } from "../manifest/protocol-manifest";

/** The insertion policy for a protocol stage relative to the kernel pipeline. */
export type InsertionPolicy =
  | "before-kernel-phase" // run before the kernel's first stage in this phase
  | "after-kernel-phase" // run after the kernel's last stage in this phase
  | "parallel"; // run alongside kernel stages (order within phase)

/**
 * A protocol-declared compiler stage. `stageRef` names a `CompilerStage`
 * implementation the protocol provides (resolved by the pipeline at compile
 * time). The descriptor is pure data.
 */
export interface ProtocolCompilerStage {
  /** Unique stage name within the pipeline (must NOT start with `kernel.`). */
  readonly name: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly phase: CompilerPhase;
  /** Ordering within the phase (lower = earlier). Kernel stages use order 10. */
  readonly order: number;
  readonly insertion: InsertionPolicy;
  /** Stages that must run before this one (by name). */
  readonly dependsOn: readonly string[];
  /** Reference to the actual CompilerStage implementation (resolved by pipeline). */
  readonly stageRef: string;
  readonly description?: string;
}

/** Port: the compiler-extension registry. */
export interface CompilerExtensionRegistry {
  register(stage: ProtocolCompilerStage): void;
  unregister(protocolId: string): void;
  getByName(name: string): ProtocolCompilerStage | undefined;
  list(): readonly ProtocolCompilerStage[];
  listByPhase(phase: CompilerPhase): readonly ProtocolCompilerStage[];
  listByProtocol(protocolId: string): readonly ProtocolCompilerStage[];
  /** Kernel-prefixed names are rejected (protocols extend, never replace). */
  isKernelStageName(name: string): boolean;
}

const KERNEL_PREFIX = "kernel.";

/** In-memory `CompilerExtensionRegistry`. */
export class InMemoryCompilerExtensionRegistry implements CompilerExtensionRegistry {
  private readonly byName = new Map<string, ProtocolCompilerStage>();

  isKernelStageName(name: string): boolean {
    return name.startsWith(KERNEL_PREFIX);
  }

  register(stage: ProtocolCompilerStage): void {
    if (this.isKernelStageName(stage.name)) {
      throw new Error(
        `CompilerExtensionRegistry: protocol stage name '${stage.name}' must not start with 'kernel.' (protocols extend, never replace)`
      );
    }
    this.byName.set(stage.name, stage);
  }

  unregister(protocolId: string): void {
    for (const [name, s] of this.byName) {
      if (s.ownerProtocolId === protocolId) this.byName.delete(name);
    }
  }

  getByName(name: string): ProtocolCompilerStage | undefined {
    return this.byName.get(name);
  }

  list(): readonly ProtocolCompilerStage[] {
    return Array.from(this.byName.values());
  }

  listByPhase(phase: CompilerPhase): readonly ProtocolCompilerStage[] {
    return Array.from(this.byName.values()).filter((s) => s.phase === phase);
  }

  listByProtocol(protocolId: string): readonly ProtocolCompilerStage[] {
    return Array.from(this.byName.values()).filter(
      (s) => s.ownerProtocolId === protocolId
    );
  }
}
