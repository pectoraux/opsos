/**
 * @kernel/communication/application/register-template — the use-case that
 * registers a message template.
 *
 * Thin orchestration: validates the template fields, delegates to
 * `TemplateRegistry.register()`, returns the registered MessageTemplate (with
 * its assigned version number).
 *
 * Validation:
 *   - id non-empty.
 *   - name non-empty.
 *   - bodyTemplate non-empty.
 *   - subjectTemplate, if present, must contain at least one non-whitespace
 *     character.
 *   - variable names must be unique within the template.
 *
 * Returns `{ ok: true, template }` on success or `{ ok: false, error }` on
 * validation failure. Failures are values (the use-case does not throw — per
 * shared-kernel convention).
 */
import type { Result } from "@kernel/shared-kernel";
import type {
  ChannelKind,
  MessageTemplate,
  TemplateRegistry,
  TemplateVariable,
} from "../domain";

// ── Input ───────────────────────────────────────────────────────────────────

export interface RegisterTemplateInput {
  readonly id: string;
  readonly name: string;
  readonly channelKind: ChannelKind;
  readonly subjectTemplate?: string;
  readonly bodyTemplate: string;
  readonly variables?: readonly TemplateVariable[];
  readonly locale?: string;
}

export interface RegisterTemplateDeps {
  readonly registry: TemplateRegistry;
}

export type RegisterTemplateOutcome = Result<MessageTemplate, string>;

// ── Use-case ────────────────────────────────────────────────────────────────

export class RegisterTemplate {
  constructor(private readonly deps: RegisterTemplateDeps) {}

  execute(input: RegisterTemplateInput): RegisterTemplateOutcome {
    if (!input.id) {
      return { ok: false, error: "template.id must be non-empty" };
    }
    if (!input.name) {
      return { ok: false, error: "template.name must be non-empty" };
    }
    if (!input.bodyTemplate) {
      return { ok: false, error: "template.bodyTemplate must be non-empty" };
    }
    if (
      input.subjectTemplate !== undefined &&
      input.subjectTemplate.trim().length === 0
    ) {
      return { ok: false, error: "template.subjectTemplate must be non-empty if present" };
    }
    // Variable name uniqueness.
    const seen = new Set<string>();
    for (const v of input.variables ?? []) {
      if (!v.name) {
        return { ok: false, error: "template.variables[].name must be non-empty" };
      }
      if (seen.has(v.name)) {
        return { ok: false, error: `template.variables[].name '${v.name}' is duplicated` };
      }
      seen.add(v.name);
    }

    const template = this.deps.registry.register({
      id: input.id,
      name: input.name,
      channelKind: input.channelKind,
      subjectTemplate: input.subjectTemplate,
      bodyTemplate: input.bodyTemplate,
      variables: input.variables ?? [],
      locale: input.locale,
    });
    return { ok: true, value: template };
  }
}

/**
 * Functional form.
 */
export function registerTemplate(
  deps: RegisterTemplateDeps,
  input: RegisterTemplateInput
): RegisterTemplateOutcome {
  return new RegisterTemplate(deps).execute(input);
}
