/**
 * @kernel/knowledge-kernel/application — barrel.
 *
 * The application layer of the Knowledge Kernel. Use-cases that orchestrate
 * the domain registries and the query engine. Depends on `domain/` and
 * `@kernel/shared-kernel` only.
 *
 * Public surface:
 *   - RegisterKnowledge use-case + RegisterKnowledgeUseCase class +
 *     RegisterKnowledgeInput / RegisterKnowledgeArtifact /
 *     RegisterKnowledgeResult / RegisterKnowledgeOutcome /
 *     RegisterKnowledgeDeps
 *   - SupersedeKnowledge use-case + SupersedeKnowledgeUseCase class +
 *     SupersedeKnowledgeInput / SupersedeKnowledgeResult /
 *     SupersedeKnowledgeOutcome
 *   - QueryKnowledge use-case + QueryKnowledgeUseCase class +
 *     QueryKnowledgeInput / QueryKnowledgeResult
 */

export type {
  RegisterKnowledgeInput,
  RegisterKnowledgeArtifact,
  RegisterKnowledgeResult,
  RegisterKnowledgeOutcome,
  RegisterKnowledgeDeps,
  RegisterKnowledge,
} from "./register-knowledge";
export { RegisterKnowledgeUseCase } from "./register-knowledge";

export type {
  SupersedeKnowledgeInput,
  SupersedeKnowledgeResult,
  SupersedeKnowledgeOutcome,
  SupersedeKnowledge,
} from "./supersede-knowledge";
export { SupersedeKnowledgeUseCase } from "./supersede-knowledge";

export type {
  QueryKnowledgeInput,
  QueryKnowledgeResult,
  QueryKnowledge,
} from "./query-knowledge";
export { QueryKnowledgeUseCase } from "./query-knowledge";
