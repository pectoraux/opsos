/**
 * @kernel/protocol-sdk/registry — the master ProtocolRegistry.
 *
 * Aggregates all per-kind contribution registries into a single facade. The
 * ProtocolHost pushes a protocol's contributions here at install time; the
 * master registry fans them out to the per-kind registries. The deterministic
 * core reads from the per-kind registries (or from this facade's typed
 * accessors).
 */

import type {
  CapabilityRegistry,
  ProtocolCapability,
} from "../capabilities";
import { InMemoryCapabilityRegistry } from "../capabilities";
import type {
  IntentRegistry,
  ProtocolIntentType,
} from "../intents";
import { InMemoryIntentRegistry } from "../intents";
import type {
  CompilerExtensionRegistry,
  ProtocolCompilerStage,
} from "../compiler";
import { InMemoryCompilerExtensionRegistry } from "../compiler";
import type {
  WorkflowRegistry,
  WorkflowTemplate,
} from "../workflows";
import { InMemoryWorkflowRegistry } from "../workflows";
import type {
  PolicyContributionRegistry,
  ProtocolPolicy,
  ProtocolRule,
} from "../policy";
import { InMemoryPolicyContributionRegistry } from "../policy";
import type {
  ReadModelRegistry,
  ProtocolReadModel,
} from "../read-models";
import { InMemoryReadModelRegistry } from "../read-models";
import type {
  AnalyticsContributionRegistry,
  ProtocolAnalytics,
} from "../analytics";
import { InMemoryAnalyticsContributionRegistry } from "../analytics";
import type {
  UIContributionRegistry,
  UIExtensionContribution,
  NavigationContribution,
} from "../ui";
import { InMemoryUIContributionRegistry } from "../ui";
import type {
  RouteRegistry,
  ProtocolApiRoute,
} from "../routes";
import { InMemoryRouteRegistry } from "../routes";
import type {
  RecommendationRegistry,
  RecommendationProvider,
} from "../recommendations";
import { InMemoryRecommendationRegistry } from "../recommendations";
import type {
  EventTypeRegistry,
  ProtocolEventType,
} from "../events";
import { InMemoryEventTypeRegistry } from "../events";
import type {
  PricingRegistry,
  ProtocolPricing,
} from "../pricing";
import { InMemoryPricingRegistry } from "../pricing";

/**
 * A protocol's full contribution set — everything its `register(host)` callback
 * pushes. The ProtocolHost collects these, then the master registry applies
 * them atomically per protocol.
 */
export interface ProtocolContributions {
  readonly capabilities: readonly ProtocolCapability[];
  readonly intentTypes: readonly ProtocolIntentType[];
  readonly compilerStages: readonly ProtocolCompilerStage[];
  readonly workflows: readonly WorkflowTemplate[];
  readonly policies: readonly ProtocolPolicy[];
  readonly rules: readonly ProtocolRule[];
  readonly readModels: readonly ProtocolReadModel[];
  readonly analytics: readonly ProtocolAnalytics[];
  readonly uiExtensions: readonly UIExtensionContribution[];
  readonly navigation: readonly NavigationContribution[];
  readonly apiRoutes: readonly ProtocolApiRoute[];
  readonly recommendations: readonly RecommendationProvider[];
  readonly eventTypes: readonly ProtocolEventType[];
  readonly pricing: readonly ProtocolPricing[];
}

/** The empty contribution set. */
export function emptyContributions(): ProtocolContributions {
  return {
    capabilities: [], intentTypes: [], compilerStages: [], workflows: [],
    policies: [], rules: [], readModels: [], analytics: [],
    uiExtensions: [], navigation: [], apiRoutes: [], recommendations: [],
    eventTypes: [], pricing: [],
  };
}

/**
 * The master registry. Holds the per-kind registries and applies/removes a
 * protocol's contributions atomically.
 */
export class ProtocolRegistry {
  readonly capabilities: CapabilityRegistry = new InMemoryCapabilityRegistry();
  readonly intents: IntentRegistry = new InMemoryIntentRegistry();
  readonly compilerExtensions: CompilerExtensionRegistry = new InMemoryCompilerExtensionRegistry();
  readonly workflows: WorkflowRegistry = new InMemoryWorkflowRegistry();
  readonly policy: PolicyContributionRegistry = new InMemoryPolicyContributionRegistry();
  readonly readModels: ReadModelRegistry = new InMemoryReadModelRegistry();
  readonly analytics: AnalyticsContributionRegistry = new InMemoryAnalyticsContributionRegistry();
  readonly ui: UIContributionRegistry = new InMemoryUIContributionRegistry();
  readonly routes: RouteRegistry = new InMemoryRouteRegistry();
  readonly recommendations: RecommendationRegistry = new InMemoryRecommendationRegistry();
  readonly events: EventTypeRegistry = new InMemoryEventTypeRegistry();
  readonly pricing: PricingRegistry = new InMemoryPricingRegistry();

  /** Apply a protocol's contributions to all per-kind registries. */
  applyContributions(contribs: ProtocolContributions): void {
    for (const c of contribs.capabilities) this.capabilities.register(c);
    for (const i of contribs.intentTypes) this.intents.register(i);
    for (const s of contribs.compilerStages) this.compilerExtensions.register(s);
    for (const w of contribs.workflows) this.workflows.register(w);
    for (const p of contribs.policies) this.policy.registerPolicy(p);
    for (const r of contribs.rules) this.policy.registerRule(r);
    for (const rm of contribs.readModels) this.readModels.register(rm);
    for (const a of contribs.analytics) this.analytics.register(a);
    for (const u of contribs.uiExtensions) this.ui.registerUI(u);
    for (const n of contribs.navigation) this.ui.registerNav(n);
    for (const rt of contribs.apiRoutes) this.routes.register(rt);
    for (const rec of contribs.recommendations) this.recommendations.register(rec);
    for (const et of contribs.eventTypes) this.events.register(et);
    for (const pr of contribs.pricing) this.pricing.register(pr);
  }

  /** Remove a protocol's contributions from all per-kind registries. */
  removeContributions(protocolId: string): void {
    this.capabilities.unregister(protocolId);
    this.intents.unregister(protocolId);
    this.compilerExtensions.unregister(protocolId);
    this.workflows.unregister(protocolId);
    this.policy.unregister(protocolId);
    this.readModels.unregister(protocolId);
    this.analytics.unregister(protocolId);
    this.ui.unregister(protocolId);
    this.routes.unregister(protocolId);
    this.recommendations.unregister(protocolId);
    this.events.unregister(protocolId);
    this.pricing.unregister(protocolId);
  }

  /** Count contributions by kind (for the inspector). */
  contributionCounts(protocolId: string): Readonly<Record<string, number>> {
    return {
      capabilities: this.capabilities.listByProtocol(protocolId).length,
      intentTypes: this.intents.listByProtocol(protocolId).length,
      compilerStages: this.compilerExtensions.listByProtocol(protocolId).length,
      workflows: this.workflows.listByProtocol(protocolId).length,
      policies: this.policy.listByProtocol(protocolId).policies.length,
      rules: this.policy.listByProtocol(protocolId).rules.length,
      readModels: this.readModels.listByProtocol(protocolId).length,
      analytics: this.analytics.listByProtocol(protocolId).length,
      uiExtensions: this.ui.listByProtocol(protocolId).ui.length,
      navigation: this.ui.listByProtocol(protocolId).nav.length,
      apiRoutes: this.routes.listByProtocol(protocolId).length,
      recommendations: this.recommendations.listByProtocol(protocolId).length,
      eventTypes: this.events.listByProtocol(protocolId).length,
      pricing: this.pricing.listByProtocol(protocolId).length,
    };
  }
}
