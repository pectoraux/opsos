/**
 * @kernel/extension/domain/registrations — the 9 registration contracts.
 *
 * Each contract is a DESCRIPTOR (plain immutable data) that a plugin pushes
 * into the registry via the typed `ExtensionHost` registrars. Where natural,
 * the descriptor embeds a canonical primitive from `@kernel/shared-kernel`
 * (`Capability`, `Policy`, `Rule`); for protocol-defined concepts with no
 * canonical primitive (intent types, workflow stages, UI mount points,
 * analytics metrics, API routes, marketplace listings), the descriptor holds
 * opaque refs / plain data only — the kernel deliberately does NOT
 * instantiate or execute protocol behavior.
 *
 * Each descriptor carries a `kind` discriminator (string literal) so the
 * registry can store them in a single typed union
 * (`ExtensionRegistration`) and dispatch on `kind` when adding.
 *
 * Per ADR-0006: descriptors reference canonical primitive TYPES from
 * `@kernel/shared-kernel` ONLY — never other modules' application /
 * infrastructure. This keeps the registry decoupled: a protocol can be
 * installed without dragging in the whole kernel.
 *
 * Pure domain layer: no I/O, no `Date.now()`, no `Math.random()`.
 */
import type {
  Capability,
  Constraint,
  Policy,
  Rule,
  SchemaRef,
} from "@kernel/shared-kernel";
import type { ExtensionId } from "./manifest";

// ── 1. CapabilityRegistration ────────────────────────────────────────────────

/**
 * Registers a `Capability` offered by a resource / actor. Embeds the
 * canonical `Capability` primitive from `@kernel/shared-kernel`.
 */
export interface CapabilityRegistration {
  readonly kind: "capability";
  readonly extensionId: ExtensionId;
  /** Canonical primitive — the kernel does NOT instantiate it. */
  readonly capability: Capability;
}

// ── 2. IntentTypeRegistration ────────────────────────────────────────────────

/**
 * Registers a new `Intent` type + its payload schema + constraints. The
 * `intentType` string is protocol-defined (e.g. `"cleaning.booking"`); the
 * kernel does NOT interpret it — it only records it for intent-routing /
 * validation by downstream modules.
 */
export interface IntentTypeRegistration {
  readonly kind: "intent-type";
  readonly extensionId: ExtensionId;
  /** Protocol-defined intent type string, e.g. `"cleaning.booking"`. */
  readonly intentType: string;
  /** Schema reference for the intent payload. */
  readonly payloadSchema: SchemaRef;
  /** Constraints that apply to intents of this type. */
  readonly constraints: readonly Constraint[];
}

// ── 3. WorkflowStageRegistration ─────────────────────────────────────────────

/**
 * Registers a stage in a `Workflow` (id + name + order + gate rule ids). The
 * kernel does NOT execute workflows — it records stage metadata so
 * downstream modules (scheduling, runtime) can compose them.
 */
export interface WorkflowStageRegistration {
  readonly kind: "workflow-stage";
  readonly extensionId: ExtensionId;
  /** Workflow id this stage belongs to. */
  readonly workflowId: string;
  /** Human-readable stage name. */
  readonly stageName: string;
  /** Ordering within the workflow (lower = earlier). */
  readonly order: number;
  /** Rule ids that gate transition into this stage. */
  readonly gateRuleIds: readonly string[];
}

// ── 4. PolicyRegistration ────────────────────────────────────────────────────

/**
 * Registers a `Policy` bundle. Embeds the canonical `Policy` primitive from
 * `@kernel/shared-kernel`. The kernel does NOT evaluate policies at
 * registration time — evaluation is the policy module's job.
 */
export interface PolicyRegistration {
  readonly kind: "policy";
  readonly extensionId: ExtensionId;
  /** Canonical primitive — the kernel does NOT evaluate it at registration. */
  readonly policy: Policy;
}

// ── 5. RuleRegistration ──────────────────────────────────────────────────────

/**
 * Registers a single `Rule`. Embeds the canonical `Rule` primitive (whose
 * `condition` is a serialisable `PredicateSpec`) from `@kernel/shared-kernel`.
 */
export interface RuleRegistration {
  readonly kind: "rule";
  readonly extensionId: ExtensionId;
  /** Canonical primitive — `condition` is a `PredicateSpec`, never a JS fn. */
  readonly rule: Rule;
}

// ── 6. UIExtensionRegistration ───────────────────────────────────────────────

/**
 * Registers a UI extension point. `componentRef` is an OPAQUE string — the
 * kernel deliberately does NOT link React components (no React in the
 * kernel). The host application resolves `componentRef` to a real component
 * at render time.
 */
export interface UIExtensionRegistration {
  readonly kind: "ui-extension";
  readonly extensionId: ExtensionId;
  /** Mount point, e.g. `"intent.detail.sidebar"`. */
  readonly mountPoint: string;
  /** Opaque ref — NO React in the kernel. */
  readonly componentRef: string;
  /** Optional static props. */
  readonly props?: Readonly<Record<string, unknown>>;
}

// ── 7. AnalyticsRegistration ─────────────────────────────────────────────────

/**
 * Registers an analytics producer: a metric name, the source event types
 * that feed it, and the aggregation to apply. The kernel does NOT compute
 * metrics — it records the contract so a downstream analytics engine can
 * subscribe to the events.
 */
export interface AnalyticsRegistration {
  readonly kind: "analytics";
  readonly extensionId: ExtensionId;
  /** Metric name, e.g. `"cleaning.jobs.completed.daily"`. */
  readonly metricName: string;
  /** Source event types that feed this metric. */
  readonly sourceEventTypes: readonly string[];
  /** Aggregation applied across source events. */
  readonly aggregation: "count" | "sum" | "avg" | "min" | "max" | "last";
}

// ── 8. ApiRouteRegistration ──────────────────────────────────────────────────

/**
 * Registers an API route. `handlerRef` is an OPAQUE string — the kernel
 * deliberately does NOT spin up an HTTP server (no HTTP in the kernel). The
 * host application resolves `handlerRef` to a real request handler at
 * server-boot time.
 */
export interface ApiRouteRegistration {
  readonly kind: "api-route";
  readonly extensionId: ExtensionId;
  /** HTTP method. */
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Route pattern, e.g. `"/api/cleaning/jobs/:id"`. */
  readonly path: string;
  /** Opaque ref — NO HTTP server in the kernel. */
  readonly handlerRef: string;
  /** Whether authentication is required. */
  readonly authRequired: boolean;
}

// ── 9. MarketplaceExtensionRegistration ──────────────────────────────────────

/**
 * Registers a marketplace listing for the extension. The kernel does NOT
 * operate a marketplace in Milestone 1 — it records the listing metadata so
 * a future marketplace service can surface it.
 */
export interface MarketplaceExtensionRegistration {
  readonly kind: "marketplace-extension";
  readonly extensionId: ExtensionId;
  /** Marketplace listing id. */
  readonly listingId: string;
  /** Display name. */
  readonly name: string;
  /** Short summary. */
  readonly summary: string;
  /** Category, e.g. `"cleaning"` / `"delivery"` / `"healthcare"`. */
  readonly category: string;
  /** Pricing model (optional — free if absent). */
  readonly pricingModel?: "free" | "subscription" | "usage" | "one-time";
  /** Publisher. */
  readonly publisher: string;
}

// ── Discriminated union ──────────────────────────────────────────────────────

/**
 * Discriminated union of all 9 registration contracts. The `kind` field is
 * the discriminator. The registry stores registrations in this shape and
 * dispatches on `kind` when adding / filtering.
 */
export type ExtensionRegistration =
  | CapabilityRegistration
  | IntentTypeRegistration
  | WorkflowStageRegistration
  | PolicyRegistration
  | RuleRegistration
  | UIExtensionRegistration
  | AnalyticsRegistration
  | ApiRouteRegistration
  | MarketplaceExtensionRegistration;

/**
 * The string-literal set of registration `kind` discriminators. Useful for
 * exhaustiveness checks.
 */
export type ExtensionRegistrationKind = ExtensionRegistration["kind"];
