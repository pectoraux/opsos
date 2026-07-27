/**
 * @kernel/application-runtime/applications/application-registry — the registry
 * of tracked applications.
 *
 * Read-only for the deterministic core; mutation happens only through the
 * ApplicationLifecycleManager. Holds applications keyed by id.
 */

import type { Application, ApplicationSummary } from "./application";

export interface ApplicationRegistry {
  put(application: Application): void;
  get(applicationId: string): Application | undefined;
  delete(applicationId: string): void;
  list(): readonly Application[];
  listByOrganization(organizationId: string): readonly Application[];
  listByProtocol(protocolId: string): readonly Application[];
  listByDomain(domain: string): readonly Application[];
}

export class InMemoryApplicationRegistry implements ApplicationRegistry {
  private readonly byId = new Map<string, Application>();

  put(application: Application): void {
    this.byId.set(application.manifest.id, application);
  }

  get(applicationId: string): Application | undefined {
    return this.byId.get(applicationId);
  }

  delete(applicationId: string): void {
    this.byId.delete(applicationId);
  }

  list(): readonly Application[] {
    return Array.from(this.byId.values());
  }

  listByOrganization(organizationId: string): readonly Application[] {
    return this.list().filter((a) => a.manifest.organizationId === organizationId);
  }

  listByProtocol(protocolId: string): readonly Application[] {
    return this.list().filter((a) => a.manifest.protocolId === protocolId);
  }

  listByDomain(domain: string): readonly Application[] {
    return this.list().filter((a) =>
      a.manifest.routing.domains.some((d) => d.domain === domain)
    );
  }
}
