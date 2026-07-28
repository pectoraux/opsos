/**
 * @kernel/application-runtime/routing — routing resolver.
 *
 * Supports: /apps/{application}, / (root), custom domains, future multi-region.
 * Applications hide OpsOS — users never see the kernel. The resolver produces
 * a `ResolvedRouting` the host's HTTP layer dispatches from.
 */

import type { ApplicationRouting, DomainMapping } from "../applications/application-manifest";

export interface ResolvedRoute {
  readonly kind: "path" | "root" | "domain";
  readonly pattern: string;
  readonly applicationId: string;
  readonly sslEnabled: boolean;
  readonly region?: string;
}

export interface ResolvedRouting {
  readonly routes: readonly ResolvedRoute[];
  readonly primaryDomain?: string;
}

export function resolveRouting(
  applicationId: string,
  routing: ApplicationRouting
): ResolvedRouting {
  const routes: ResolvedRoute[] = [];

  if (routing.rootRoute) {
    routes.push({ kind: "root", pattern: "/", applicationId, sslEnabled: true });
  }

  routes.push({
    kind: "path",
    pattern: routing.pathPrefix,
    applicationId,
    sslEnabled: true,
  });

  for (const d of routing.domains) {
    routes.push({
      kind: "domain",
      pattern: d.domain,
      applicationId,
      sslEnabled: d.sslEnabled,
      region: d.region,
    });
  }

  const primaryDomain = routing.domains.find((d) => d.primary)?.domain;

  return { routes, primaryDomain };
}

/**
 * Resolve which application a request (host + path) should route to.
 * Returns the application id or undefined. Domain matching takes precedence
 * over path matching.
 */
export function resolveApplicationForRequest(
  host: string,
  path: string,
  applications: ReadonlyArray<{ id: string; routing: ApplicationRouting }>
): string | undefined {
  // Domain match first (highest precedence).
  for (const app of applications) {
    if (app.routing.domains.some((d) => d.domain === host)) {
      return app.id;
    }
  }
  // Path-prefix match.
  for (const app of applications) {
    if (path.startsWith(app.routing.pathPrefix)) {
      return app.id;
    }
    if (app.routing.rootRoute && (path === "/" || path.startsWith("/"))) {
      return app.id;
    }
  }
  return undefined;
}
