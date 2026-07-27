/**
 * @kernel/compiler/stages/validator — phase `validate`.
 *
 * Looks up the intent-type registration in the `ExtensionRegistry` matching
 * `intent.type`. If a protocol declared the type, records the registration
 * (its schema ref is available to later stages / protocols). If no protocol
 * declared the type, records a `warn` diagnostic — the kernel does NOT refuse
 * unknown intent types in M2 (a protocol may register a validator stage that
 * enforces stricter rules).
 *
 * Pure w.r.t. `(ctx)` — reads the registry only.
 */

import type { Result, KernelError } from "@kernel/shared-kernel";
import { ok } from "@kernel/shared-kernel";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

export class ValidatorStage implements CompilerStage {
  readonly name = "kernel.validator";
  readonly phase = "validate" as const;
  readonly order = 10;

  run(ctx: CompilationContext): Result<CompilationContext, KernelError> {
    const intent = ctx.state.normalizedIntent ?? ctx.intent;
    const diags = [...ctx.state.diagnostics];

    const registration = ctx.registry
      .intentTypes()
      .find((r) => r.intentType === intent.type);

    if (!registration) {
      diags.push(
        diagnostic(
          this.name,
          "warn",
          "INTENT_TYPE_UNREGISTERED",
          `No protocol declared intent type '${intent.type}'. Kernel validation is permissive; a protocol may register a stricter validator stage.`,
          ctx.clock.now()
        )
      );
    }

    return ok(ctx.with({ intentTypeRegistration: registration, diagnostics: diags }));
  }
}
