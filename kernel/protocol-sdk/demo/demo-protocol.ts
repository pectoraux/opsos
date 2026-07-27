/**
 * @kernel/protocol-sdk/demo — the reference Demo Protocol.
 *
 * Demonstrates SDK usage with NO business logic. Registers exactly one of each
 * contribution kind the SDK exercise requires:
 *   - 1 capability
 *   - 1 intent type
 *   - 1 policy (+ 1 rule it references)
 *   - 1 workflow
 *   - 1 read model
 *   - 1 compiler extension
 *
 * This is NOT a cleaning / delivery / healthcare protocol. It exists so the
 * kernel's self-test and inspector can prove the SDK end-to-end: define →
 * validate → install → enable → registrations appear in the registries.
 *
 *   export default defineProtocol({ manifest: { ... } }).register((host) => {
 *     host.registerCapability(defineCapability({ ... }))
 *         .registerIntentType(defineIntent({ ... }))
 *         ...;
 *   });
 */

import {
  defineProtocol,
  defineCapability,
  defineIntent,
  definePolicy,
  defineRule,
  defineWorkflow,
  defineCompilerStage,
  defineReadModel,
} from "../sdk";
import type { Protocol } from "../sdk";
import type { ProtocolManifest } from "../manifest/protocol-manifest";
import { KERNEL_API_VERSION, KERNEL_VERSION } from "../manifest/protocol-manifest";

const DEMO_MANIFEST: ProtocolManifest = {
  id: "opsos.protocol.demo",
  name: "demo",
  displayName: "Demo Protocol",
  description:
    "Reference protocol for SDK self-test. Demonstrates every registration kind with NO business logic.",
  version: "1.0.0",
  apiVersion: KERNEL_API_VERSION,
  author: { name: "OpsOS", url: "https://opsos.dev" },
  license: "MIT",
  homepage: "https://opsos.dev/protocols/demo",
  icon: "demo",
  minimumKernelVersion: KERNEL_VERSION,
  dependencies: [],
  permissions: [
    { kind: "compiler-stage", scope: "plan", description: "Insert a plan-phase stage" },
    { kind: "read-model", scope: "demo.event", description: "Register a demo read model" },
  ],
  capabilities: ["demo.execute"],
  intentTypes: ["demo.run"],
  extensions: ["demo.sidebar"],
  featureFlags: { "demo.verbose": true },
};

/** The Demo Protocol — `export default` from a protocol module. */
export const demoProtocol: Protocol = defineProtocol({
  manifest: DEMO_MANIFEST,
}).register((host) => {
  host
    // 1 capability
    .registerCapability(
      defineCapability({
        id: "demo.cap.execute",
        capabilityType: "demo.execute",
        version: "1.0.0",
        inputs: [
          { name: "intentId", schema: { ref: "demo.intent-id", version: 1 }, required: true },
        ],
        outputs: [
          { name: "result", schema: { ref: "demo.result", version: 1 }, required: true },
        ],
        qualityMetrics: [
          { name: "latency", value: 100, unit: "ms", description: "typical execution latency" },
        ],
        costModel: { model: "free" },
        tags: ["demo", "self-test"],
        description: "Executes a demo intent (no business logic).",
      })
    )
    // 1 intent type
    .registerIntentType(
      defineIntent({
        intentType: "demo.run",
        version: "1.0.0",
        payloadSchema: { ref: "demo.run.payload", version: 1 },
        validation: [],
        defaultPolicies: [],
        requiredCapabilities: [
          { capabilityType: "demo.execute", quantity: { amount: 1, unit: "task" }, constraints: [] },
        ],
        description: "A demo intent — proves the compiler discovers registered intent types.",
      })
    )
    // 1 rule + 1 policy that references it
    .registerRule(
      defineRule({
        id: "demo.rule.allow-when-verbose",
        name: "Allow when demo.verbose flag is set",
        condition: { op: "eq", args: ["featureFlags.demo.verbose", true] },
        effect: "allow",
        priority: 100,
        scope: "tenant",
        description: "Demo rule — allows execution when the verbose flag is on.",
      })
    )
    .registerPolicy(
      definePolicy({
        id: "demo.policy.verbose-allow",
        version: "1.0.0",
        name: "Demo Verbose Allow",
        scope: "tenant",
        ruleIds: ["demo.rule.allow-when-verbose"],
        priority: 50,
        effect: "allow",
        description: "Demo policy gating on the verbose feature flag.",
      })
    )
    // 1 workflow
    .registerWorkflow(
      defineWorkflow({
        id: "demo.workflow.run",
        version: "1.0.0",
        name: "Demo Run Workflow",
        stages: [
          { id: "demo.stage.start", name: "Start", order: 10, gateRuleIds: [] },
          { id: "demo.stage.execute", name: "Execute", order: 20, gateRuleIds: ["demo.rule.allow-when-verbose"] },
          { id: "demo.stage.finish", name: "Finish", order: 30, gateRuleIds: [] },
        ],
        triggerIntentTypes: ["demo.run"],
        description: "A three-stage demo workflow — no execution logic.",
      })
    )
    // 1 read model
    .registerReadModel(
      defineReadModel({
        id: "demo.readmodel.runs",
        version: "1.0.0",
        name: "Demo Run Count",
        sourceEventTypes: ["DemoRunCompleted"],
        targetSchema: { ref: "demo.run.count", version: 1 },
        transformRef: "demo.readmodel.runs.transform",
        description: "Counts demo runs — resolved to a pure apply function by the host.",
      })
    )
    // 1 compiler extension (inserts a stage AFTER the kernel planner; never replaces)
    .registerCompilerStage(
      defineCompilerStage({
        name: "demo.planner-logger",
        version: "1.0.0",
        phase: "plan",
        order: 20, // after kernel.planner (order 10)
        insertion: "after-kernel-phase",
        dependsOn: ["kernel.planner"],
        stageRef: "demo.planner-logger.stage",
        description: "Logs the drafted plan — no business logic, demonstrates extension.",
      })
    );
});

export default demoProtocol;
