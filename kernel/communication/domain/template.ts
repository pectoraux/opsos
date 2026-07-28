/**
 * @kernel/communication/domain/template — the MessageTemplate primitive +
 * TemplateRegistry PORT.
 *
 * A MessageTemplate is a reusable, locale-aware subject/body pair with a
 * declared variable list. Templates are referenced by id from Notifications;
 * the engine renders them with the notification's `variables` map.
 *
 * Rendering uses a `{{name}}` mustache-shaped substitution. Unknown variables
 * are replaced with the empty string (deterministic). Required variables that
 * are missing cause a render error (returned in the NotificationResult errors
 * list, NOT thrown).
 *
 * Determinism: rendering is a pure string function. `version` is a
 * monotonically-increasing integer; registering the same id again replaces the
 * prior version (with a new version number — see the registry implementation).
 */
import type { ChannelKind } from "./channel";

// ── Template variable ───────────────────────────────────────────────────────

/**
 * A declared template variable. `required` variables MUST be supplied at
 * render time; `defaultValue` is used when a non-required variable is omitted.
 */
export interface TemplateVariable {
  readonly name: string;
  readonly required?: boolean;
  readonly defaultValue?: string;
}

// ── MessageTemplate ─────────────────────────────────────────────────────────

/**
 * A reusable message template. `channelKind` constrains which channels the
 * template is eligible for (an email template cannot be rendered for an SMS
 * channel; the engine reports a mismatch as an error).
 *
 * `subjectTemplate` is optional (SMS / WhatsApp / voice have no subject).
 * `locale` is optional (BCP-47 tag, e.g. "en-US"); absence means "default".
 */
export interface MessageTemplate {
  readonly id: string;
  readonly name: string;
  readonly channelKind: ChannelKind;
  readonly subjectTemplate?: string;
  readonly bodyTemplate: string;
  readonly variables: readonly TemplateVariable[];
  readonly locale?: string;
  readonly version: number;
}

// ── Rendered template ───────────────────────────────────────────────────────

/**
 * The output of `TemplateRegistry.render()`. `subject` is absent when the
 * template has no `subjectTemplate`.
 */
export interface RenderedTemplate {
  readonly subject?: string;
  readonly body: string;
}

// ── TemplateRegistry PORT ───────────────────────────────────────────────────

/**
 * The TemplateRegistry PORT.
 *
 * - `register(template)` — register a new template, or replace an existing one
 *                          (the version is incremented on replace).
 * - `get(id)`            — look up a template by id (latest version).
 * - `list()`             — all registered templates (latest version each).
 * - `render(id, vars)`   — render the template with the given variables.
 *                          Returns `undefined` if the template is not found;
 *                          throws never — missing-required-variable errors
 *                          surface as an error string in the second element
 *                          of the returned tuple (see `RenderOutcome`).
 *
 * NOTE: the actual return type of `render` is `RenderOutcome` (below) so
 * callers can distinguish "not found" from "render error". This is a deliberate
 * departure from the docstring shorthand in the directory spec; the engine
 * relies on the tuple form to populate `NotificationResult.errors`.
 */
export interface RenderOutcome {
  readonly ok: boolean;
  readonly rendered?: RenderedTemplate;
  readonly error?: string;
}

export interface TemplateRegistry {
  register(template: Omit<MessageTemplate, "version"> & { readonly version?: number }): MessageTemplate;
  get(id: string): MessageTemplate | undefined;
  list(): readonly MessageTemplate[];
  render(templateId: string, variables: Readonly<Record<string, string>>): RenderOutcome;
}
