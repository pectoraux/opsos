/**
 * @kernel/communication/infrastructure/in-memory-template-registry — the
 * default in-memory `TemplateRegistry` implementation.
 *
 * Stores templates by id, tracking the next version number per id. Registering
 * the same id again replaces the template and increments its version
 * (1-based). `render(id, vars)` performs `{{name}}` substitution.
 *
 * Rendering rules (deterministic, never throws):
 *   - `{{name}}` is replaced by `vars[name]` if present, else by the
 *     variable's `defaultValue` if declared, else by the empty string.
 *   - A `required` variable that is missing (and has no defaultValue) causes a
 *     render error — the outcome's `ok` is `false`, `error` names the
 *     variable.
 *   - Whitespace inside `{{ }}` is permitted: `{{ name }}` === `{{name}}`.
 *   - Escaped braces are NOT supported (no `\{{` handling) — the grammar is
 *     intentionally minimal.
 *
 * Determinism: pure functions. No Date.now/Math.random. The same template +
 * variables always produce byte-identical output.
 */
import type {
  MessageTemplate,
  RenderOutcome,
  TemplateRegistry,
  TemplateVariable,
} from "../domain";

// ── Helpers ─────────────────────────────────────────────────────────────────

const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function renderString(
  template: string,
  variables: Readonly<Record<string, string>>,
  declared: ReadonlyMap<string, TemplateVariable>,
  missingRequired: string[]
): string {
  return template.replace(TOKEN_RE, (_match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return variables[name]!;
    }
    const decl = declared.get(name);
    if (decl !== undefined && decl.defaultValue !== undefined) {
      return decl.defaultValue;
    }
    if (decl !== undefined && decl.required === true) {
      missingRequired.push(name);
    }
    return "";
  });
}

// ── Implementation ──────────────────────────────────────────────────────────

export class InMemoryTemplateRegistry implements TemplateRegistry {
  private readonly templates = new Map<string, MessageTemplate>();
  private readonly versions = new Map<string, number>();

  register(
    template: Omit<MessageTemplate, "version"> & { readonly version?: number }
  ): MessageTemplate {
    const currentVersion = this.versions.get(template.id) ?? 0;
    const nextVersion = template.version ?? currentVersion + 1;
    const stored: MessageTemplate = {
      id: template.id,
      name: template.name,
      channelKind: template.channelKind,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
      variables: template.variables,
      locale: template.locale,
      version: nextVersion,
    };
    this.templates.set(template.id, stored);
    this.versions.set(template.id, nextVersion);
    return stored;
  }

  get(id: string): MessageTemplate | undefined {
    return this.templates.get(id);
  }

  list(): readonly MessageTemplate[] {
    return Array.from(this.templates.values());
  }

  render(
    templateId: string,
    variables: Readonly<Record<string, string>>
  ): RenderOutcome {
    const template = this.templates.get(templateId);
    if (template === undefined) {
      return { ok: false, error: `template '${templateId}' not found` };
    }

    const declared = new Map<string, TemplateVariable>();
    for (const v of template.variables) declared.set(v.name, v);

    const missingRequired: string[] = [];
    const body = renderString(
      template.bodyTemplate,
      variables,
      declared,
      missingRequired
    );
    let subject: string | undefined;
    if (template.subjectTemplate !== undefined) {
      subject = renderString(
        template.subjectTemplate,
        variables,
        declared,
        missingRequired
      );
    }

    if (missingRequired.length > 0) {
      // Deduplicate while preserving order.
      const unique = Array.from(new Set(missingRequired));
      return {
        ok: false,
        error: `missing required template variables: ${unique.join(", ")}`,
      };
    }

    return {
      ok: true,
      rendered: subject !== undefined ? { subject, body } : { body },
    };
  }
}
