/**
 * @kernel/protocol-sdk/analytics — protocol-declared analytics producers.
 */

import type { SemverString } from "../manifest/protocol-manifest";

export interface ProtocolAnalytics {
  readonly metricName: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly sourceEventTypes: readonly string[];
  readonly aggregation: "count" | "sum" | "avg" | "min" | "max" | "last";
  readonly description?: string;
}

export interface AnalyticsContributionRegistry {
  register(a: ProtocolAnalytics): void;
  unregister(protocolId: string): void;
  getByMetric(name: string): ProtocolAnalytics | undefined;
  list(): readonly ProtocolAnalytics[];
  listByProtocol(protocolId: string): readonly ProtocolAnalytics[];
}

export class InMemoryAnalyticsContributionRegistry implements AnalyticsContributionRegistry {
  private readonly byMetric = new Map<string, ProtocolAnalytics>();
  register(a: ProtocolAnalytics): void { this.byMetric.set(a.metricName, a); }
  unregister(protocolId: string): void {
    for (const [n, a] of this.byMetric) if (a.ownerProtocolId === protocolId) this.byMetric.delete(n);
  }
  getByMetric(name: string): ProtocolAnalytics | undefined { return this.byMetric.get(name); }
  list(): readonly ProtocolAnalytics[] { return Array.from(this.byMetric.values()); }
  listByProtocol(protocolId: string): readonly ProtocolAnalytics[] {
    return this.list().filter((a) => a.ownerProtocolId === protocolId);
  }
}
