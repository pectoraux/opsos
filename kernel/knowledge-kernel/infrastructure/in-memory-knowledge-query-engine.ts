/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-knowledge-query-engine —
 * the in-memory `KnowledgeQueryEngine` implementation. THE query interface
 * the compiler + coordination + resource kernels call.
 *
 * A thin orchestration layer over the five sibling registries:
 *   - KnowledgeRegistry  (query)
 *   - ProcedureRegistry  (listByKnowledgeItem)
 *   - RegulationRegistry (listByKnowledgeItem / listByJurisdiction)
 *   - FactRegistry       (listBySubject)
 *   - GuidelineRegistry  (listByKnowledgeItem)
 *
 * The engine owns NO state. Every method delegates to the registries and
 * shapes the results according to the documented sort orders:
 *
 *   lookup             → confidence DESC, then id lexicographic ASC
 *   lookupProcedures   → parent confidence DESC, then procedure id ASC
 *   lookupRegulations  → parent confidence DESC, then regulation id ASC
 *   lookupFacts        → confidence DESC, then id ASC (already sorted by FactRegistry)
 *   lookupGuidelines   → parent confidence DESC, then priority DESC, then id ASC
 *   checkCompliance    → matchedRegulations sorted by severity DESC
 *                          (prohibited → mandatory → advisory → info),
 *                          then id ASC; violations enumerate every
 *                          requirement of every matched mandatory /
 *                          prohibited regulation.
 *
 * `now` defaults to `0` on every method (caller sources from clock; the
 * engine is usable without a clock for pure-data queries).
 *
 * Determinism rule: identical inputs + identical registries → identical
 * outputs. No `Date.now()`, no `Math.random()`.
 */

import type {
  KnowledgeItem,
  Procedure,
  Regulation,
  Fact,
  Guideline,
  Evidence,
} from "@kernel/shared-kernel";
import type { RegulationSeverity } from "@kernel/shared-kernel";
import type {
  KnowledgeQueryEngine,
  KnowledgeQueryEngineDeps,
  ComplianceResult,
  ComplianceViolation,
} from "../domain";
import type { KnowledgeRegistry } from "../domain";
import type { ProcedureRegistry } from "../domain";
import type { RegulationRegistry } from "../domain";
import type { FactRegistry } from "../domain";
import type { GuidelineRegistry } from "../domain";

/**
 * Severity ranking for compliance sorting. Higher = more severe.
 * prohibited (3) > mandatory (2) > advisory (1) > info (0).
 */
const SEVERITY_RANK: Record<RegulationSeverity, number> = {
  prohibited: 3,
  mandatory: 2,
  advisory: 1,
  info: 0,
};

/**
 * Severities that constitute obligations the caller MUST verify (i.e., they
 * produce `ComplianceViolation` entries). `advisory` and `info` regulations
 * are surfaced as matchedRegulations but do NOT produce violations.
 */
const OBLIGATION_SEVERITIES: ReadonlySet<RegulationSeverity> = new Set([
  "mandatory",
  "prohibited",
]);

export class InMemoryKnowledgeQueryEngine implements KnowledgeQueryEngine {
  private readonly registry: KnowledgeRegistry;
  private readonly procedures: ProcedureRegistry;
  private readonly regulations: RegulationRegistry;
  private readonly facts: FactRegistry;
  private readonly guidelines: GuidelineRegistry;

  constructor(deps: KnowledgeQueryEngineDeps) {
    this.registry = deps.registry;
    this.procedures = deps.procedures;
    this.regulations = deps.regulations;
    this.facts = deps.facts;
    this.guidelines = deps.guidelines;
  }

  lookup(
    subjectKind: string,
    subjectId: string,
    tags?: readonly string[],
    now: number = 0
  ): readonly KnowledgeItem[] {
    return this.registry.query({
      subjectKind,
      subjectId,
      tags,
      now,
    });
  }

  lookupProcedures(
    subjectKind: string,
    subjectId: string,
    now: number = 0
  ): readonly Procedure[] {
    const items = this.registry.query({
      subjectKind,
      subjectId,
      kinds: ["procedure"],
      now,
    });
    const out: Array<{ procedure: Procedure; parentConfidence: number }> = [];
    for (const item of items) {
      const procedures = this.procedures.listByKnowledgeItem(item.id);
      for (const procedure of procedures) {
        out.push({ procedure, parentConfidence: item.confidence });
      }
    }
    out.sort((a, b) => {
      if (a.parentConfidence !== b.parentConfidence) {
        return b.parentConfidence - a.parentConfidence;
      }
      return a.procedure.id < b.procedure.id
        ? -1
        : a.procedure.id > b.procedure.id
          ? 1
          : 0;
    });
    return out.map((e) => e.procedure);
  }

  lookupRegulations(
    subjectKind: string,
    subjectId: string,
    jurisdiction?: string,
    now: number = 0
  ): readonly Regulation[] {
    const items = this.registry.query({
      subjectKind,
      subjectId,
      kinds: ["regulation"],
      now,
    });
    const out: Array<{ regulation: Regulation; parentConfidence: number }> = [];
    for (const item of items) {
      const regs = this.regulations.listByKnowledgeItem(item.id);
      for (const reg of regs) {
        if (jurisdiction !== undefined && reg.jurisdiction !== jurisdiction) {
          continue;
        }
        out.push({ regulation: reg, parentConfidence: item.confidence });
      }
    }
    out.sort((a, b) => {
      if (a.parentConfidence !== b.parentConfidence) {
        return b.parentConfidence - a.parentConfidence;
      }
      return a.regulation.id < b.regulation.id
        ? -1
        : a.regulation.id > b.regulation.id
          ? 1
          : 0;
    });
    return out.map((e) => e.regulation);
  }

  lookupFacts(
    subjectKind: string,
    subjectId: string,
    _now: number = 0
  ): readonly Fact[] {
    // FactRegistry.listBySubject already sorts by confidence DESC, then id ASC.
    return this.facts.listBySubject(subjectKind, subjectId);
  }

  lookupGuidelines(
    subjectKind: string,
    subjectId: string,
    now: number = 0
  ): readonly Guideline[] {
    const items = this.registry.query({
      subjectKind,
      subjectId,
      kinds: ["guideline"],
      now,
    });
    const out: Array<{
      guideline: Guideline;
      parentConfidence: number;
    }> = [];
    for (const item of items) {
      const guidelines = this.guidelines.listByKnowledgeItem(item.id);
      for (const g of guidelines) {
        out.push({ guideline: g, parentConfidence: item.confidence });
      }
    }
    out.sort((a, b) => {
      if (a.parentConfidence !== b.parentConfidence) {
        return b.parentConfidence - a.parentConfidence;
      }
      if (a.guideline.priority !== b.guideline.priority) {
        return b.guideline.priority - a.guideline.priority;
      }
      return a.guideline.id < b.guideline.id
        ? -1
        : a.guideline.id > b.guideline.id
          ? 1
          : 0;
    });
    return out.map((e) => e.guideline);
  }

  checkCompliance(
    subjectKind: string,
    subjectId: string,
    jurisdiction: string,
    now: number = 0
  ): ComplianceResult {
    const matched = this.lookupRegulations(
      subjectKind,
      subjectId,
      jurisdiction,
      now
    );
    // Sort matched by severity DESC, then id ASC.
    const sorted = matched.slice().sort((a, b) => {
      const sa = SEVERITY_RANK[a.severity];
      const sb = SEVERITY_RANK[b.severity];
      if (sa !== sb) return sb - sa;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const violations: ComplianceViolation[] = [];
    for (const reg of sorted) {
      if (!OBLIGATION_SEVERITIES.has(reg.severity)) continue;
      for (const requirement of reg.requirements) {
        violations.push({
          regulationId: reg.id,
          requirement,
        });
      }
    }
    return {
      compliant: violations.length === 0,
      matchedRegulations: sorted,
      violations,
    };
  }
}

/**
 * Re-exported Evidence type for consumers of the engine that want to
 * reference the evidence shape carried by `KnowledgeItem.evidence`.
 */
export type { Evidence };
