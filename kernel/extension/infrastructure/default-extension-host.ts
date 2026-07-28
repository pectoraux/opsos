/**
 * @kernel/extension/infrastructure/default-extension-host — reference
 * `ExtensionHost` implementation.
 *
 * Constructed with a `MutableExtensionRegistry`. Each `registerX` validates
 * the descriptor's `kind` discriminator + `extensionId` non-emptiness,
 * pushes the descriptor into the registry via `add(reg)`, and returns `this`
 * for chaining.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `registerX` is called ONLY during `plugin.register(host)` at BOOT /
 * PROTOCOL-INSTALL time — OUTSIDE the deterministic core. The deterministic
 * core (RuntimeExecutor) never calls `registerX`; it only READS the registry
 * via `host.registry` / `ExtensionRegistry` queries.
 *
 * Determinism: no `Date.now()` / `Math.random()`. The host is a thin
 * validating push-proxy over the registry.
 */
import { ValidationError } from "@kernel/shared-kernel";
import type { ExtensionHost } from "../domain/extension-host";
import type { MutableExtensionRegistry } from "../domain/extension-registry";
import type { ExtensionId } from "../domain/manifest";
import type {
  AnalyticsRegistration,
  ApiRouteRegistration,
  CapabilityRegistration,
  ExtensionRegistration,
  ExtensionRegistrationKind,
  IntentTypeRegistration,
  MarketplaceExtensionRegistration,
  PolicyRegistration,
  RuleRegistration,
  UIExtensionRegistration,
  WorkflowStageRegistration,
} from "../domain/registrations";

/**
 * Reference `ExtensionHost`. Holds a `MutableExtensionRegistry` reference
 * (set at construction); each `registerX` validates + pushes via `add(reg)`.
 */
export class DefaultExtensionHost implements ExtensionHost {
  constructor(private readonly _registry: MutableExtensionRegistry) {}

  /** The registry this host pushes into (read-only view). */
  get registry(): MutableExtensionRegistry {
    return this._registry;
  }

  registerCapability(reg: CapabilityRegistration): this {
    assertKind(reg, "capability", "registerCapability");
    assertExtensionId(reg.extensionId, "registerCapability");
    this._registry.add(reg);
    return this;
  }

  registerIntentType(reg: IntentTypeRegistration): this {
    assertKind(reg, "intent-type", "registerIntentType");
    assertExtensionId(reg.extensionId, "registerIntentType");
    this._registry.add(reg);
    return this;
  }

  registerWorkflowStage(reg: WorkflowStageRegistration): this {
    assertKind(reg, "workflow-stage", "registerWorkflowStage");
    assertExtensionId(reg.extensionId, "registerWorkflowStage");
    this._registry.add(reg);
    return this;
  }

  registerPolicy(reg: PolicyRegistration): this {
    assertKind(reg, "policy", "registerPolicy");
    assertExtensionId(reg.extensionId, "registerPolicy");
    this._registry.add(reg);
    return this;
  }

  registerRule(reg: RuleRegistration): this {
    assertKind(reg, "rule", "registerRule");
    assertExtensionId(reg.extensionId, "registerRule");
    this._registry.add(reg);
    return this;
  }

  registerUIExtension(reg: UIExtensionRegistration): this {
    assertKind(reg, "ui-extension", "registerUIExtension");
    assertExtensionId(reg.extensionId, "registerUIExtension");
    this._registry.add(reg);
    return this;
  }

  registerAnalytics(reg: AnalyticsRegistration): this {
    assertKind(reg, "analytics", "registerAnalytics");
    assertExtensionId(reg.extensionId, "registerAnalytics");
    this._registry.add(reg);
    return this;
  }

  registerApiRoute(reg: ApiRouteRegistration): this {
    assertKind(reg, "api-route", "registerApiRoute");
    assertExtensionId(reg.extensionId, "registerApiRoute");
    this._registry.add(reg);
    return this;
  }

  registerMarketplaceExtension(
    reg: MarketplaceExtensionRegistration
  ): this {
    assertKind(reg, "marketplace-extension", "registerMarketplaceExtension");
    assertExtensionId(reg.extensionId, "registerMarketplaceExtension");
    this._registry.add(reg);
    return this;
  }
}

/**
 * Defensive: assert the descriptor's `kind` matches the method that received
 * it. TS prevents this at the type level, but a caller using `as any` to
 * bypass types would be caught here.
 *
 * Throws `ValidationError` (a `KernelError`) on mismatch — `installPlugin`
 * catches it and returns `err(KernelError)`.
 */
function assertKind(
  reg: ExtensionRegistration,
  expected: ExtensionRegistrationKind,
  where: string
): void {
  if (reg.kind !== expected) {
    throw new ValidationError(
      `${where}: expected kind '${expected}', got '${reg.kind}'`
    );
  }
}

/** Defensive: assert the descriptor's `extensionId` is non-empty. */
function assertExtensionId(extensionId: ExtensionId, where: string): void {
  if (!extensionId || extensionId.trim() === "") {
    throw new ValidationError(`${where}: extensionId must be non-empty`);
  }
}
