/**
 * @kernel/governance/domain/feature-lifecycle — the lifecycle states that every
 * governed capability, API, stage, or extension-point passes through.
 *
 * A `FeatureLifecycleState` is the platform-wide vocabulary for "how ready is
 * this thing, and may I depend on it?". The legal transitions encode the
 * OpsOS evolution contract: nothing jumps from `experimental` straight to
 * `retired` without passing through `stable` (the only path to retirement is
 * `stable → deprecated → retired`). This is the equivalent of Kubernetes's
 * `alpha → beta → GA → deprecated → removed` ladder.
 *
 * A `FeatureLifecycleDeclaration` records that, at a given moment, a named
 * capability of a specific artifact version was declared to be in a given
 * state — with an optional human-readable reason. Declarations are APPEND-ONLY
 * history; they are never mutated or deleted.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

/**
 * The five lifecycle states every governed feature passes through.
 *
 * - `experimental`: in-development, no compatibility guarantees, may disappear.
 * - `preview`:      publicly visible, breaking changes still allowed, do-not-use-in-prod.
 * - `stable`:       production-ready, backward-compatible per the semver contract.
 * - `deprecated`:   still works, will be removed in a future release, do-not-add-uses.
 * - `retired`:      no longer available; references must have migrated away.
 */
export type FeatureLifecycleState =
  | "experimental"
  | "preview"
  | "stable"
  | "deprecated"
  | "retired";

/**
 * The complete legal-transition table. Read as: from the key state, the listed
 * target states are permitted. Every state also permits a self-transition
 * (re-declaring the same state, e.g. to update the reason).
 *
 * The contract:
 *   experimental → {experimental, preview, retired}
 *   preview      → {preview, stable, retired}
 *   stable       → {stable, deprecated}
 *   deprecated   → {deprecated, retired}
 *   retired      → {retired}
 *
 * Notably:
 *   - `experimental` MAY be retired directly (it never had compatibility guarantees).
 *   - `preview` MAY be retired directly (it never had compatibility guarantees).
 *   - `stable` may NOT be retired directly — it must pass through `deprecated` first
 *     so consumers have at least one release to migrate. This is the platform's
 *     analog of Kubernetes's deprecation policy.
 */
export const LEGAL_LIFECYCLE_TRANSITIONS: Readonly<
  Record<FeatureLifecycleState, readonly FeatureLifecycleState[]>
> = {
  experimental: ["experimental", "preview", "retired"],
  preview: ["preview", "stable", "retired"],
  stable: ["stable", "deprecated"],
  deprecated: ["deprecated", "retired"],
  retired: ["retired"],
};

/**
 * True iff transitioning `from` → `to` is permitted by the OpsOS lifecycle
 * contract. Self-transitions are always permitted (re-declaration is allowed).
 */
export function canTransitionLifecycle(
  from: FeatureLifecycleState,
  to: FeatureLifecycleState
): boolean {
  const allowed = LEGAL_LIFECYCLE_TRANSITIONS[from];
  return allowed ? allowed.indexOf(to) >= 0 : false;
}

/**
 * An append-only declaration that a named capability of a specific artifact
 * version is in a given lifecycle state.
 *
 * `capability` is a free-form dotted path (e.g. `"compiler.stage.optimizer"`,
 * `"api.route.intents"`, `"protocol.capability.scheduling"`) — the registry
 * does NOT interpret it; it stores and queries it verbatim.
 */
export interface FeatureLifecycleDeclaration {
  /** The artifact the declaration applies to (e.g. `"kernel"`, `"protocol/cleaning"`). */
  readonly artifactId: string;
  /** The specific version of the artifact. */
  readonly version: string;
  /** The dotted path of the capability being declared (e.g. `"compiler.stage.optimizer"`). */
  readonly capability: string;
  /** The lifecycle state the capability is declared to be in. */
  readonly state: FeatureLifecycleState;
  /** Epoch-millis when the declaration was made (sourced from the caller — never Date.now()). */
  readonly declaredAt: number;
  /** Optional human-readable rationale (e.g. "Promoted after 30-day soak in production"). */
  readonly reason?: string;
}
