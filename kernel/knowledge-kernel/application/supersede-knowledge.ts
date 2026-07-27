/**
 * @kernel/knowledge-kernel/application/supersede-knowledge — the use-case that
 * supersedes an old knowledge item with a new version.
 *
 * Knowledge evolves. A v1 procedure ("use 5% bleach") is replaced by v2
 * ("use 10% bleach, effective 2025"). The kernel's model: the new item is
 * registered normally (a fresh `KnowledgeItem` with a new version), then
 * `KnowledgeRegistry.supersede(oldId, newId, now)` marks the old item as
 * `"superseded"` with `supersededBy = newId`. Future queries return only the
 * new (active) item; historical replay still retrieves the old version via
 * `getVersion(oldId, oldVersion)`.
 *
 * This use-case is THE sanctioned supersession path: it registers the new
 * item AND calls `supersede` in one call, with input validation up front.
 *
 * Outcomes:
 *   - `"superseded"` — old item marked superseded, new item registered.
 *   - `"not-found"`  — old item not in the registry.
 *   - `"same-id"`    — new item id equals old item id (invalid: a supersession
 *                       must produce a NEW id; for in-place version bumps,
 *                       register a new version directly).
 *   - `"failed"`     — any other failure.
 *
 * Determinism rule: identical inputs + identical registry → identical
 * outputs. No `Date.now()`, no `Math.random()`.
 */

import type { KnowledgeItemId, KnowledgeItem } from "@kernel/shared-kernel";
import type { KnowledgeRegistry } from "../domain";

/**
 * The input to `SupersedeKnowledge.execute`. Pure data.
 */
export interface SupersedeKnowledgeInput {
  /** The id of the item being superseded. MUST already be registered. */
  readonly oldId: KnowledgeItemId;
  /**
   * The new item that supersedes the old. MUST be registered by this
   * use-case (callers do NOT register it separately). MUST have a different
   * id from `oldId`.
   */
  readonly newItem: KnowledgeItem;
  /** Clock-sourced epoch-millis — used as `updatedAt` for the old item. */
  readonly now: number;
}

/**
 * The outcome of `SupersedeKnowledge.execute`.
 *   - `"superseded"` — old marked superseded by new; new registered.
 *   - `"not-found"`  — old item not in the registry.
 *   - `"same-id"`    — `newItem.id === oldId` (invalid).
 *   - `"failed"`     — any other failure.
 */
export type SupersedeKnowledgeOutcome =
  | "superseded"
  | "not-found"
  | "same-id"
  | "failed";

/**
 * The result of `SupersedeKnowledge.execute`.
 */
export interface SupersedeKnowledgeResult {
  readonly outcome: SupersedeKnowledgeOutcome;
  readonly oldId: KnowledgeItemId;
  readonly newId: KnowledgeItemId;
  readonly diagnostics: readonly string[];
}

/**
 * The use-case PORT.
 */
export interface SupersedeKnowledge {
  execute(input: SupersedeKnowledgeInput): SupersedeKnowledgeResult;
}

/**
 * Default implementation.
 */
export class SupersedeKnowledgeUseCase implements SupersedeKnowledge {
  constructor(private readonly registry: KnowledgeRegistry) {}

  execute(input: SupersedeKnowledgeInput): SupersedeKnowledgeResult {
    const diagnostics: string[] = [];
    const oldId = input.oldId;
    const newId = input.newItem.id;

    if (oldId === newId) {
      diagnostics.push(
        `supersede-knowledge: new item id equals old id '${oldId}' — must produce a new id`
      );
      return { outcome: "same-id", oldId, newId, diagnostics };
    }

    const old = this.registry.get(oldId);
    if (!old) {
      diagnostics.push(
        `supersede-knowledge: old item '${oldId}' not registered`
      );
      return { outcome: "not-found", oldId, newId, diagnostics };
    }

    // Register the new item first (so the supersession chain has a target).
    this.registry.register(input.newItem);
    diagnostics.push(
      `supersede-knowledge: registered new item '${newId}' kind='${input.newItem.kind}' version=${input.newItem.version}`
    );

    // Mark the old item as superseded.
    this.registry.supersede(oldId, newId, input.now);
    diagnostics.push(
      `supersede-knowledge: marked old item '${oldId}' (was version ${old.version}) as superseded by '${newId}' at now=${input.now}`
    );

    return { outcome: "superseded", oldId, newId, diagnostics };
  }
}
