/**
 * @kernel/knowledge-kernel/domain/regulation-registry — the RegulationRegistry
 * PORT.
 *
 * A `Regulation` is a rule with LEGAL FORCE — issued by a jurisdictional
 * authority (federal, state, municipal, industry body), with a severity
 * (info, advisory, mandatory, prohibited), a code, requirements, and
 * optional penalties. Regulations are universal across operational
 * industries: building codes, food safety, environmental, labour, medical,
 * transport.
 *
 * The Regulation Registry owns the canonical `Regulation` record linked back
 * to its `KnowledgeItem` parent (which carries applicability + provenance +
 * version). The Knowledge Query Engine queries this registry when callers
 * ask "what regulations apply to subject X in jurisdiction Y?" and during
 * compliance checks.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { RegulationId } from "@kernel/shared-kernel";
import type {
  Regulation,
  RegulationSeverity,
} from "@kernel/shared-kernel";

/**
 * The RegulationRegistry PORT.
 */
export interface RegulationRegistry {
  /** Registers (or replaces) a regulation record. */
  register(regulation: Regulation): void;
  /** Returns the regulation record, or `undefined` if unknown. */
  get(id: RegulationId): Regulation | undefined;
  /** Returns all regulations, sorted by id lexicographic. */
  list(): readonly Regulation[];
  /**
   * Returns all regulations whose `jurisdiction` matches exactly
   * (case-sensitive), sorted by id lexicographic.
   */
  listByJurisdiction(jurisdiction: string): readonly Regulation[];
  /**
   * Returns all regulations of the given severity, sorted by id lexicographic.
   */
  listBySeverity(severity: RegulationSeverity): readonly Regulation[];
  /**
   * Returns all regulations linked to the given knowledge item, sorted by id
   * lexicographic.
   */
  listByKnowledgeItem(itemId: string): readonly Regulation[];
}
