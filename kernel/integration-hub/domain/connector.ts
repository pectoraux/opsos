/**
 * @kernel/integration-hub/domain/connector — the Connector primitive and its
 * registry port.
 *
 * A `Connector` is the descriptor of an external system OpsOS talks to:
 * calendars (Google/Outlook), payments (PaySwap), maps, identity providers,
 * accounting, ERP, CRM, IoT, AI providers, and custom integrations. Each
 * connector carries a `kind`, a `provider` slug (e.g. "payswap",
 * "google-calendar"), an opaque `config` blob, a runtime `status`, and a
 * readonly list of `capabilities` (the resource strings this connector
 * serves — e.g. "calendar.events", "payment.charge").
 *
 * The `ConnectorRegistry` PORT is the registry surface implemented by the
 * infrastructure layer (`InMemoryConnectorRegistry`). It supports lookup by
 * id, kind, and provider, plus a status mutation.
 *
 * Determinism: connectors are pure data; no `Date.now()` / `Math.random()`.
 * Status transitions are value replacements, not in-place mutations.
 */

/** The kind of external system a connector talks to. */
export type ConnectorKind =
  | "calendar"
  | "payment"
  | "maps"
  | "identity"
  | "accounting"
  | "erp"
  | "crm"
  | "iot"
  | "ai-provider"
  | "custom";

/** Runtime health state of a connector. */
export type ConnectorStatus = "active" | "disabled" | "error" | "rate-limited";

/**
 * Opaque connector configuration. The kernel does not interpret this blob —
 * adapters / dispatchers consume it. Treat it as a serialisable property bag
 * (URLs, API keys are referenced by name, never stored in the kernel).
 */
export type ConnectorConfig = Readonly<Record<string, unknown>>;

/** A connector — the descriptor of an external integration target. */
export interface Connector {
  readonly id: string;
  readonly kind: ConnectorKind;
  readonly name: string;
  /** Provider slug, e.g. "payswap", "google-calendar", "openai". */
  readonly provider: string;
  /** Opaque configuration blob consumed by adapters / dispatchers. */
  readonly config: ConnectorConfig;
  readonly status: ConnectorStatus;
  /** Resource strings this connector serves, e.g. "calendar.events". */
  readonly capabilities: readonly string[];
}

/**
 * The port implemented by `InMemoryConnectorRegistry`. Stores connectors and
 * supports lookup by id, kind, and provider, plus a status mutation.
 */
export interface ConnectorRegistry {
  register(connector: Connector): void;
  get(id: string): Connector | undefined;
  list(): readonly Connector[];
  listByKind(kind: ConnectorKind): readonly Connector[];
  listByProvider(provider: string): readonly Connector[];
  updateStatus(id: string, status: ConnectorStatus): void;
}
