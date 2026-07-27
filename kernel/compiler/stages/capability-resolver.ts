/**
 * @kernel/compiler/stages/capability-resolver — phase `resolve`.
 *
 * Resolves candidate `Capability`s from the `ExtensionRegistry` whose
 * `capabilityType` could satisfy the intent, and derives `Demand`s from the
 * intent.
 *
 * Domain-independent demand derivation (M2): produces a single demand per
 * intent — `resourceType: "any"`, `quantity: { amount: 1, unit: "task" }`,
 * temporal window derived from the intent's first temporal constraint or a
 * default window. Protocols may register additional resolver stages to
 * produce richer demand sets.
 */

import type {
  Result,
  KernelError,
  Demand,
  DemandId,
  Constraint,
  TemporalWindow,
} from "@kernel/shared-kernel";
import { ok, asId } from "@kernel/shared-kernel";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

const DEFAULT_WINDOW: TemporalWindow = {
  start: 0,
  end: Number.MAX_SAFE_INTEGER,
  timezone: "UTC",
};

export class CapabilityResolverStage implements CompilerStage {
  readonly name = "kernel.capability-resolver";
  readonly phase = "resolve" as const;
  readonly order = 10;

  run(ctx: CompilationContext): Result<CompilationContext, KernelError> {
    const intent = ctx.state.normalizedIntent ?? ctx.intent;
    const now = ctx.clock.now();

    // Candidate capabilities: all registered (protocols declare what they offer).
    // A protocol-specific resolver stage would filter by capabilityType vs intent.type.
    const capabilities = ctx.registry
      .capabilities()
      .map((r) => r.capability);

    // Derive a temporal window from the intent's first temporal constraint, if any.
    const temporalConstraint: Constraint | undefined = intent.constraints.find(
      (c) => c.kind === "temporal-window" || c.kind === "deadline"
    );
    const window: TemporalWindow =
      temporalConstraint && temporalConstraint.params &&
      typeof temporalConstraint.params.start === "number" &&
      typeof temporalConstraint.params.end === "number"
        ? {
            start: Number(temporalConstraint.params.start),
            end: Number(temporalConstraint.params.end),
            timezone: typeof temporalConstraint.params.timezone === "string"
              ? String(temporalConstraint.params.timezone)
              : "UTC",
          }
        : DEFAULT_WINDOW;

    const demand: Demand = {
      id: asId<"DemandId">(`demand:${intent.id}:0`),
      intentId: intent.id,
      resourceType: "any",
      quantity: { amount: 1, unit: "task" },
      constraints: intent.constraints,
      temporalWindow: window,
      priority: intent.priority,
    };

    const diags = [...ctx.state.diagnostics];
    diags.push(
      diagnostic(
        this.name,
        "info",
        "DEMAND_DERIVED",
        `Derived 1 demand from intent '${intent.id}'; ${capabilities.length} candidate capability(ies).`,
        now
      )
    );

    return ok(ctx.with({ demands: [demand], capabilities, diagnostics: diags }));
  }
}
