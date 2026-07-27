/**
 * @kernel/protocol-sdk/registry/protocol-host — the host bridge protocols
 * register against.
 *
 * A protocol's `register(host)` callback receives a `ProtocolHost`. Each
 * `registerX` method accepts a contribution descriptor (produced by the
 * `define*` DSL builders, which omit `ownerProtocolId`), stamps the owning
 * protocol id onto it, and collects it into an accumulator. The lifecycle
 * manager then applies the accumulated set to the master `ProtocolRegistry`
 * atomically on enable.
 */

import type { ProtocolContributions } from "./protocol-registry";
import type { ProtocolCapability } from "../capabilities";
import type { ProtocolIntentType } from "../intents";
import type { ProtocolCompilerStage } from "../compiler";
import type { WorkflowTemplate } from "../workflows";
import type { ProtocolPolicy, ProtocolRule } from "../policy";
import type { ProtocolReadModel } from "../read-models";
import type { ProtocolAnalytics } from "../analytics";
import type { UIExtensionContribution, NavigationContribution } from "../ui";
import type { ProtocolApiRoute } from "../routes";
import type { RecommendationProvider } from "../recommendations";
import type { ProtocolEventType } from "../events";
import type { ProtocolPricing } from "../pricing";

/** Mutable accumulator (internal). */
class ContributionsBuilder implements ProtocolContributions {
  capabilities: ProtocolCapability[] = [];
  intentTypes: ProtocolIntentType[] = [];
  compilerStages: ProtocolCompilerStage[] = [];
  workflows: WorkflowTemplate[] = [];
  policies: ProtocolPolicy[] = [];
  rules: ProtocolRule[] = [];
  readModels: ProtocolReadModel[] = [];
  analytics: ProtocolAnalytics[] = [];
  uiExtensions: UIExtensionContribution[] = [];
  navigation: NavigationContribution[] = [];
  apiRoutes: ProtocolApiRoute[] = [];
  recommendations: RecommendationProvider[] = [];
  eventTypes: ProtocolEventType[] = [];
  pricing: ProtocolPricing[] = [];
}

type WithOwner<T> = Omit<T, "ownerProtocolId">;

/**
 * The host a protocol registers against. Each `registerX` accepts a
 * contribution descriptor (without `ownerProtocolId`), stamps the owning
 * protocol id onto it, and returns `this` for chaining. `build()` returns the
 * frozen contribution set.
 */
export class ProtocolHost {
  private readonly builder = new ContributionsBuilder();
  private readonly _protocolId: string;

  constructor(protocolId: string) {
    this._protocolId = protocolId;
  }

  get protocolId(): string {
    return this._protocolId;
  }

  private stamp<T extends { ownerProtocolId: string }>(c: WithOwner<T>): T {
    return { ...c, ownerProtocolId: this._protocolId } as T;
  }

  registerCapability(c: WithOwner<ProtocolCapability>): this {
    this.builder.capabilities.push(this.stamp(c));
    return this;
  }
  registerIntentType(i: WithOwner<ProtocolIntentType>): this {
    this.builder.intentTypes.push(this.stamp(i));
    return this;
  }
  registerCompilerStage(s: WithOwner<ProtocolCompilerStage>): this {
    this.builder.compilerStages.push(this.stamp(s));
    return this;
  }
  registerWorkflow(w: WithOwner<WorkflowTemplate>): this {
    this.builder.workflows.push(this.stamp(w));
    return this;
  }
  registerPolicy(p: WithOwner<ProtocolPolicy>): this {
    this.builder.policies.push(this.stamp(p));
    return this;
  }
  registerRule(r: WithOwner<ProtocolRule>): this {
    this.builder.rules.push(this.stamp(r));
    return this;
  }
  registerReadModel(rm: WithOwner<ProtocolReadModel>): this {
    this.builder.readModels.push(this.stamp(rm));
    return this;
  }
  registerAnalytics(a: WithOwner<ProtocolAnalytics>): this {
    this.builder.analytics.push(this.stamp(a));
    return this;
  }
  registerUIExtension(u: WithOwner<UIExtensionContribution>): this {
    this.builder.uiExtensions.push(this.stamp(u));
    return this;
  }
  registerNavigation(n: WithOwner<NavigationContribution>): this {
    this.builder.navigation.push(this.stamp(n));
    return this;
  }
  registerApiRoute(r: WithOwner<ProtocolApiRoute>): this {
    this.builder.apiRoutes.push(this.stamp(r));
    return this;
  }
  registerRecommendation(rec: WithOwner<RecommendationProvider>): this {
    this.builder.recommendations.push(this.stamp(rec));
    return this;
  }
  registerEventType(et: WithOwner<ProtocolEventType>): this {
    this.builder.eventTypes.push(this.stamp(et));
    return this;
  }
  registerPricing(pr: WithOwner<ProtocolPricing>): this {
    this.builder.pricing.push(this.stamp(pr));
    return this;
  }

  /** Freeze the accumulated contributions. Called by the lifecycle manager. */
  build(): ProtocolContributions {
    return { ...this.builder };
  }
}
