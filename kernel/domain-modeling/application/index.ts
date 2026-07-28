/**
 * @kernel/domain-modeling/application — barrel.
 *
 * The application layer of the Domain Modeling Framework. Use-cases that
 * orchestrate the domain registries. Depends on `domain/` and
 * `@kernel/shared-kernel` only.
 *
 * Public surface:
 *   - RegisterDomain use-case + RegisterDomainUseCase class +
 *     RegisterDomainInput / RegisterDomainResult / RegisterDomainOutcome /
 *     RegisterDomainDeps / RegisterDomainDiagnostic + toValidationError helper
 *   - QueryDomain use-case + QueryDomainUseCase class +
 *     QueryDomainInput / QueryDomainResult / ResolvedEntityType
 *   - ValidateEntity use-case + ValidateEntityUseCase class +
 *     ValidateEntityInput / ValidateEntityResult / ValidateEntityDiagnostic
 */

export type {
  RegisterDomainInput,
  RegisterDomainOutcome,
  RegisterDomainDiagnostic,
  RegisterDomainResult,
  RegisterDomainDeps,
  RegisterDomain,
} from "./register-domain";
export { RegisterDomainUseCase, toValidationError } from "./register-domain";

export type {
  QueryDomainInput,
  QueryDomainResult,
  ResolvedEntityType,
  QueryDomain,
} from "./query-domain";
export { QueryDomainUseCase } from "./query-domain";

export type {
  ValidateEntityInput,
  ValidateEntityResult,
  ValidateEntityDiagnostic,
  ValidateEntity,
} from "./validate-entity";
export { ValidateEntityUseCase } from "./validate-entity";
