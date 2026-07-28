/**
 * Cleaning Ecosystem — Index
 *
 * Exports knowledge, domain, protocols, and applications.
 * Everything is built on top of @kernel/api/v1 — ZERO platform modifications.
 */

export { cleaningKnowledgeArtifacts } from "./knowledge/cleaning-knowledge";
export { cleaningDomain } from "./domain/cleaning-domain";
export {
  residentialProtocol,
  commercialProtocol,
  hospitalProtocol,
  cleaningProtocols,
} from "./protocols/cleaning-protocols";
export {
  eksCleanApp,
  sparkleApp,
  freshHomeApp,
  cleaningApplications,
} from "./applications/cleaning-applications";
