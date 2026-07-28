/**
 * @kernel/protocol-sdk/intents — the IntentRegistry.
 *
 * Protocols declare intent types: the schema for an intent's payload, its
 * validation rules, default policies, compiler hooks, and required
 * capabilities. The compiler discovers these automatically and uses them in
 * the Normalizer + Validator + CapabilityResolver stages.
 */

import type {
  IntentId,
  SchemaRef,
  Constraint,
  PredicateSpec,
  PolicyEffect,
  CapabilityRequirement,
} from "@kernel/shared-kernel";
import type { SemverString } from "../manifest/protocol-manifest";

/**
 * A hook the compiler invokes at a named point. `stageRef` names a compiler
 * stage the protocol registers (via the compiler-extensions module) that runs
 * at this hook.
 */
export interface CompilerHook {
  readonly phase: "pre-normalize" | "post-validate" | "pre-plan" | "post-plan";
  readonly stageRef: string;
  readonly order: number;
}

/** A default policy applied to intents of this type. */
export interface IntentDefaultPolicy {
  readonly name: string;
  readonly effect: PolicyEffect;
  readonly condition: PredicateSpec;
  readonly priority: number;
}

/**
 * A protocol-declared intent type. The compiler reads this to validate intent
 * payloads and resolve required capabilities.
 */
export interface ProtocolIntentType {
  /** Intent type id (matches `manifest.intentTypes`), e.g. `"cleaning.booking"`. */
  readonly intentType: string;
  /** Protocol id that owns this intent type. */
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  /** Schema reference for the intent payload. */
  readonly payloadSchema: SchemaRef;
  /** Validation constraints applied to the payload. */
  readonly validation: readonly Constraint[];
  /** Default policies applied when no explicit policy matches. */
  readonly defaultPolicies: readonly IntentDefaultPolicy[];
  /** Compiler hooks invoked during compilation of this intent type. */
  readonly compilerHooks: readonly CompilerHook[];
  /** Capabilities required to satisfy intents of this type. */
  readonly requiredCapabilities: readonly CapabilityRequirement[];
  readonly description?: string;
}

/** Port: the intent registry. */
export interface IntentRegistry {
  register(intentType: ProtocolIntentType): void;
  unregister(protocolId: string): void;
  getByType(intentType: string): ProtocolIntentType | undefined;
  list(): readonly ProtocolIntentType[];
  listByProtocol(protocolId: string): readonly ProtocolIntentType[];
}

/** In-memory `IntentRegistry`. */
export class InMemoryIntentRegistry implements IntentRegistry {
  private readonly byType = new Map<string, ProtocolIntentType>();

  register(intentType: ProtocolIntentType): void {
    this.byType.set(intentType.intentType, intentType);
  }

  unregister(protocolId: string): void {
    for (const [type, it] of this.byType) {
      if (it.ownerProtocolId === protocolId) this.byType.delete(type);
    }
  }

  getByType(intentType: string): ProtocolIntentType | undefined {
    return this.byType.get(intentType);
  }

  list(): readonly ProtocolIntentType[] {
    return Array.from(this.byType.values());
  }

  listByProtocol(protocolId: string): readonly ProtocolIntentType[] {
    return Array.from(this.byType.values()).filter(
      (i) => i.ownerProtocolId === protocolId
    );
  }
}
