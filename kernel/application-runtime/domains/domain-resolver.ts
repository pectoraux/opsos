/**
 * @kernel/application-runtime/domains — domain resolver.
 *
 * Resolves which domain is primary, validates SSL coverage, and provides
 * domain→application lookup (used by the routing resolver).
 */

import type { DomainMapping } from "../applications/application-manifest";

export interface ResolvedDomains {
  readonly primary?: string;
  readonly all: readonly DomainMapping[];
  readonly sslCovered: readonly string[];
}

export function resolveDomains(domains: readonly DomainMapping[]): ResolvedDomains {
  const primary = domains.find((d) => d.primary)?.domain;
  const sslCovered = domains.filter((d) => d.sslEnabled).map((d) => d.domain);
  return { primary, all: domains, sslCovered };
}
