/**
 * @kernel/compiler/stages/normalizer — phase `normalize`.
 *
 * Validates the intent's structural shape and fills defaults:
 *   - `priority` defaults to `{ level: 0 }` if absent/invalid.
 *   - `constraints` defaults to `[]`.
 *   - `status` is normalized to `"declared"` if absent.
 *
 * Pure. No I/O. Records an `error` diagnostic (which, depending on options,
 * may abort) if `intent.type` is empty or `payload` is not an object.
 */

import type { Result, KernelError, Intent, Priority } from "@kernel/shared-kernel";
import { ok, asId } from "@kernel/shared-kernel";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

export class NormalizerStage implements CompilerStage {
  readonly name = "kernel.normalizer";
  readonly phase = "normalize" as const;
  readonly order = 10;

  run(ctx: CompilationContext): Result<CompilationContext, KernelError> {
    const intent = ctx.intent;
    const diags = [...ctx.state.diagnostics];

    if (!intent.type || intent.type.trim() === "") {
      diags.push(diagnostic(this.name, "error", "INTENT_TYPE_EMPTY", "Intent type is empty.", ctx.clock.now()));
    }
    if (intent.payload === null || typeof intent.payload !== "object" || Array.isArray(intent.payload)) {
      diags.push(diagnostic(this.name, "error", "INTENT_PAYLOAD_INVALID", "Intent payload must be an object.", ctx.clock.now()));
    }

    const priority: Priority =
      intent.priority && typeof intent.priority.level === "number"
        ? intent.priority
        : { level: 0 };

    const normalizedIntent: Intent = {
      ...intent,
      type: intent.type ?? "",
      priority,
      constraints: intent.constraints ?? [],
      status: intent.status ?? "declared",
      updatedAt: ctx.clock.now(),
    };

    return ok(ctx.with({ normalizedIntent, diagnostics: diags }));
  }
}
