/**
 * @kernel/protocol-sdk/routes — protocol-declared API routes.
 *
 * `handlerRef` is an OPAQUE string — the kernel does NOT spin up an HTTP
 * server. The host application resolves `handlerRef` to a real request handler
 * at server-boot time.
 */

import type { SemverString } from "../manifest/protocol-manifest";

export interface ProtocolApiRoute {
  readonly id: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly handlerRef: string;
  readonly authRequired: boolean;
  readonly description?: string;
}

export interface RouteRegistry {
  register(route: ProtocolApiRoute): void;
  unregister(protocolId: string): void;
  list(): readonly ProtocolApiRoute[];
  listByProtocol(protocolId: string): readonly ProtocolApiRoute[];
  findByPath(method: string, path: string): ProtocolApiRoute | undefined;
}

export class InMemoryRouteRegistry implements RouteRegistry {
  private readonly routes: ProtocolApiRoute[] = [];
  register(route: ProtocolApiRoute): void { this.routes.push(route); }
  unregister(protocolId: string): void {
    for (let i = this.routes.length - 1; i >= 0; i--) {
      if (this.routes[i]!.ownerProtocolId === protocolId) this.routes.splice(i, 1);
    }
  }
  list(): readonly ProtocolApiRoute[] { return this.routes.slice(); }
  listByProtocol(protocolId: string): readonly ProtocolApiRoute[] {
    return this.routes.filter((r) => r.ownerProtocolId === protocolId);
  }
  findByPath(method: string, path: string): ProtocolApiRoute | undefined {
    return this.routes.find((r) => r.method === method && r.path === path);
  }
}
