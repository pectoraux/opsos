/**
 * Kernel runtime singleton — initialized once, shared across all API routes.
 *
 * This is the ONLY place in the web app that imports kernel modules.
 * The page.tsx uses pre-computed static data for rendering; API routes
 * use this singleton for live operations.
 */

import { SeededRandomSource, FixedRuntimeClock } from "@kernel/runtime";
import { InMemoryEventStore } from "@kernel/events";
import { InMemoryPolicyEngine } from "@kernel/policy";
import { NoopObservability } from "@kernel/observability";
import { createConfigRegistry, InMemoryConfigSource } from "@kernel/config";
import { DefaultCompilerPipeline, createDefaultStages } from "@kernel/compiler";
import { NoopScheduler } from "@kernel/scheduling";
import { ProtocolRegistry, DefaultLifecycleManager } from "@kernel/protocol-sdk";
import { demoProtocol } from "@kernel/protocol-sdk";
import { InMemoryApplicationRegistry, DefaultApplicationLifecycleManager } from "@kernel/application-runtime";
import { eksCleanDemoApplication } from "@kernel/application-runtime";
import { createInMemoryCoordinationEngines } from "@kernel/coordination";
import { createInMemoryResourceKernel } from "@kernel/resource-kernel";
import { createInMemoryKnowledgeKernel } from "@kernel/knowledge-kernel";
import { createInMemoryDomainModeling } from "@kernel/domain-modeling";
import { createInMemoryComposition } from "@kernel/composition";
import { createConformanceEngine, REFERENCE_SCENARIOS } from "@kernel/conformance";
import { createIntelligenceFramework } from "@kernel/intelligence";
import { createGovernanceFramework } from "@kernel/governance";
import { createEcosystemConformanceEngine } from "@kernel/ecosystem-conformance";
import { createAIWorkforce } from "@kernel/ai-workforce";
import { createCommunicationRuntime } from "@kernel/communication";
import { createWorkflowRuntime } from "@kernel/workflow-runtime";
import { createIntegrationHub, DemoPaymentConnector } from "@kernel/integration-hub";
import { createTwinRuntime } from "@kernel/twin-runtime";
import { createExperienceRuntime } from "@kernel/experience-runtime";
import { asId, aggregateStreamId, ANY_VERSION } from "@kernel/shared-kernel";
import type { EventInput } from "@kernel/events";
import type { ProtocolManifest } from "@kernel/protocol-sdk";
import type { ApplicationManifest } from "@kernel/application-runtime";

// Singleton state
let initialized = false;

interface KernelRuntime {
  clock: FixedRuntimeClock;
  random: SeededRandomSource;
  eventStore: InstanceType<typeof InMemoryEventStore>;
  policyEngine: InMemoryPolicyEngine;
  protocolRegistry: ProtocolRegistry;
  protocolLifecycle: DefaultLifecycleManager;
  appRegistry: InMemoryApplicationRegistry;
  appLifecycle: DefaultApplicationLifecycleManager;
  coordination: ReturnType<typeof createInMemoryCoordinationEngines>;
  resourceKernel: ReturnType<typeof createInMemoryResourceKernel>;
  knowledgeKernel: ReturnType<typeof createInMemoryKnowledgeKernel>;
  domainModeling: ReturnType<typeof createInMemoryDomainModeling>;
  composition: ReturnType<typeof createInMemoryComposition>;
  conformanceEngine: ReturnType<typeof createConformanceEngine>;
  intelligence: ReturnType<typeof createIntelligenceFramework>;
  governance: ReturnType<typeof createGovernanceFramework>;
  ecosystemConformance: ReturnType<typeof createEcosystemConformanceEngine>;
  workforce: ReturnType<typeof createAIWorkforce>;
  communication: ReturnType<typeof createCommunicationRuntime>;
  workflow: ReturnType<typeof createWorkflowRuntime>;
  integrationHub: ReturnType<typeof createIntegrationHub>;
  twinRuntime: ReturnType<typeof createTwinRuntime>;
  experienceRuntime: ReturnType<typeof createExperienceRuntime>;
  startTime: number;
}

let runtime: KernelRuntime | null = null;

export function getKernelRuntime(): KernelRuntime {
  if (runtime) return runtime;

  const SEED = 42;
  const BASE_TIME = 1700000000000;
  const clock = new FixedRuntimeClock(BASE_TIME);
  const random = new SeededRandomSource(SEED);
  const eventStore = new InMemoryEventStore({ generateEventId: () => random.uuid() });

  // Protocol SDK
  const protocolRegistry = new ProtocolRegistry();
  const protocolLifecycle = new DefaultLifecycleManager({
    registry: protocolRegistry,
    clock,
    registerProtocol: (manifest: ProtocolManifest, host: any) => {
      demoProtocol.register(host);
    },
  });

  // Install demo protocol
  protocolLifecycle.discover(demoProtocol.manifest);
  protocolLifecycle.validate(demoProtocol.manifest.id);
  protocolLifecycle.install(demoProtocol.manifest.id);
  protocolLifecycle.enable(demoProtocol.manifest.id);

  // Application Runtime
  const appRegistry = new InMemoryApplicationRegistry();
  const appLifecycle = new DefaultApplicationLifecycleManager({
    registry: appRegistry,
    clock,
    getInstalledProtocolVersion: (id: string) =>
      id === demoProtocol.manifest.id ? demoProtocol.manifest.version : undefined,
  });

  // Install demo app
  appLifecycle.create(eksCleanDemoApplication);
  appLifecycle.install(eksCleanDemoApplication.id);
  appLifecycle.configure(eksCleanDemoApplication.id);
  appLifecycle.activate(eksCleanDemoApplication.id);

  // Other runtimes
  const coordination = createInMemoryCoordinationEngines();
  const resourceKernel = createInMemoryResourceKernel();
  const knowledgeKernel = createInMemoryKnowledgeKernel();
  const domainModeling = createInMemoryDomainModeling();
  const composition = createInMemoryComposition();
  const conformanceEngine = createConformanceEngine();
  const intelligence = createIntelligenceFramework();
  const governance = createGovernanceFramework();
  const ecosystemConformance = createEcosystemConformanceEngine();
  const workforce = createAIWorkforce();
  const communication = createCommunicationRuntime();
  const workflow = createWorkflowRuntime();
  const integrationHub = createIntegrationHub();
  const twinRuntime = createTwinRuntime();
  const experienceRuntime = createExperienceRuntime();

  // Policy engine with a demo rule
  const policyEngine = new InMemoryPolicyEngine();
  policyEngine.register({
    id: asId<"PolicyId">("demo.allow-all"),
    version: 1,
    name: "Demo Allow-All",
    scope: "global",
    priority: 1,
    effect: "allow",
    status: "active",
    rules: [{
      id: asId<"RuleId">("demo.rule.allow"),
      name: "allow",
      condition: { op: "exists", args: ["type"] },
      effect: "allow",
      priority: 1,
      scope: "global",
    }],
  });

  runtime = {
    clock,
    random,
    eventStore,
    policyEngine,
    protocolRegistry,
    protocolLifecycle,
    appRegistry,
    appLifecycle,
    coordination,
    resourceKernel,
    knowledgeKernel,
    domainModeling,
    composition,
    conformanceEngine,
    intelligence,
    governance,
    ecosystemConformance,
    workforce,
    communication,
    workflow,
    integrationHub,
    twinRuntime,
    experienceRuntime,
    startTime: BASE_TIME,
  };

  initialized = true;
  return runtime;
}

export function getKernelStartTime(): number {
  return getKernelRuntime().startTime;
}
