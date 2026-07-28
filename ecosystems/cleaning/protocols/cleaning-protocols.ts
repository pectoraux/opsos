/**
 * Cleaning Protocols — behavior layer.
 *
 * Multiple protocols share the same Cleaning Domain but differ in:
 * policies, workflows, capabilities, knowledge references, marketplace strategy.
 *
 * Built using defineProtocol + register() from @kernel/api/v1.
 * The frozen platform is not modified.
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
} from "@kernel/api/v1";

// ── Shared Capabilities ─────────────────────────────────────────────────────

const routineCleanCapability = defineCapability({
  id: "cleaning.cap.routine",
  capabilityType: "cleaning.routine",
  version: "1.0.0",
  inputs: [{ name: "target", schema: { ref: "cleaning.target", version: 1 }, required: true }],
  outputs: [{ name: "result", schema: { ref: "cleaning.result", version: 1 }, required: true }],
  tags: ["cleaning", "routine"],
  description: "Perform routine cleaning of a surface, room, or area.",
});

const deepCleanCapability = defineCapability({
  id: "cleaning.cap.deep-clean",
  capabilityType: "cleaning.deep-clean",
  version: "1.0.0",
  inputs: [{ name: "target", schema: { ref: "cleaning.target", version: 1 }, required: true }],
  outputs: [{ name: "result", schema: { ref: "cleaning.result", version: 1 }, required: true }],
  tags: ["cleaning", "deep-clean"],
  description: "Perform deep cleaning including disinfection and detail work.",
});

const disinfectCapability = defineCapability({
  id: "cleaning.cap.disinfect",
  capabilityType: "cleaning.disinfect",
  version: "1.0.0",
  inputs: [{ name: "target", schema: { ref: "cleaning.target", version: 1 }, required: true }],
  outputs: [{ name: "result", schema: { ref: "cleaning.result", version: 1 }, required: true }],
  tags: ["cleaning", "disinfection", "healthcare"],
  description: "Disinfect surfaces using EPA-registered chemicals with proper contact times.",
});

// ── Shared Intent Types ─────────────────────────────────────────────────────

const bookCleaningIntent = defineIntent({
  intentType: "cleaning.book",
  version: "1.0.0",
  payloadSchema: { ref: "cleaning.book.payload", version: 1 },
  requiredCapabilities: [{ capabilityType: "cleaning.routine", quantity: { amount: 1, unit: "task" }, constraints: [] }],
  description: "Book a cleaning service. Evaluates all available cleaners and cleaning companies.",
});

const requestDeepCleanIntent = defineIntent({
  intentType: "cleaning.deep-clean",
  version: "1.0.0",
  payloadSchema: { ref: "cleaning.deep-clean.payload", version: 1 },
  requiredCapabilities: [{ capabilityType: "cleaning.deep-clean", quantity: { amount: 1, unit: "task" }, constraints: [] }],
  description: "Request a deep cleaning service with disinfection.",
});

// ── Shared Rules ────────────────────────────────────────────────────────────

const certifiedCleanerRule = defineRule({
  id: "cleaning.rule.certified-cleaner",
  name: "Cleaner Must Be Certified",
  condition: { op: "eq", args: ["cleaner.certified", false] },
  effect: "deny",
  priority: 200,
  scope: "tenant",
  description: "Deny assignment if cleaner is not certified.",
});

const chemicalCompatibleRule = defineRule({
  id: "cleaning.rule.chemical-compatible",
  name: "Chemical Must Be Compatible With Surface Material",
  condition: { op: "eq", args: ["chemical.compatible", false] },
  effect: "deny",
  priority: 200,
  scope: "tenant",
  description: "Deny if chemical is incompatible with the surface material (e.g., acid on marble).",
});

const equipmentAvailableRule = defineRule({
  id: "cleaning.rule.equipment-available",
  name: "Required Equipment Must Be Available",
  condition: { op: "eq", args: ["equipment.available", false] },
  effect: "deny",
  priority: 150,
  scope: "tenant",
  description: "Deny if required equipment is not available.",
});

// ── Shared Read Models ──────────────────────────────────────────────────────

const cleaningHistoryReadModel = defineReadModel({
  id: "cleaning.readmodel.history",
  version: "1.0.0",
  name: "Cleaning History",
  sourceEventTypes: ["CleaningTaskCompleted", "CleaningTaskFailed", "InspectionPassed", "InspectionFailed"],
  targetSchema: { ref: "cleaning.history", version: 1 },
  transformRef: "cleaning.readmodel.history.transform",
  description: "Projection of cleaning task history and inspection results.",
});

// ── Shared Compiler Extension ───────────────────────────────────────────────

const chemicalCompatibilityStage = defineCompilerStage({
  name: "cleaning.chemical-compatibility-checker",
  version: "1.0.0",
  phase: "validate",
  order: 15,
  insertion: "after-kernel-phase",
  dependsOn: ["kernel.validator"],
  stageRef: "cleaning.chemical-compatibility-checker.stage",
  description: "Validates chemical-surface compatibility using knowledge facts (e.g., no acid on marble).",
});

// ── 1. Residential Cleaning Protocol ────────────────────────────────────────

export const residentialProtocol = defineProtocol({
  manifest: {
    id: "cleaning.protocol.residential",
    version: "1.0.0",
    name: "residential-cleaning",
    displayName: "Residential Cleaning",
    description: "Home cleaning protocol — routine cleaning, deep cleaning, move-in/move-out, Airbnb turnover.",
    apiVersion: "1.0.0",
    author: { name: "Eks Group" },
    license: "Commercial",
    minimumKernelVersion: "1.0.0",
    dependencies: [],
    permissions: [{ kind: "compiler-stage", scope: "validate", description: "Chemical compatibility checker" }],
    capabilities: ["cleaning.routine", "cleaning.deep-clean"],
    intentTypes: ["cleaning.book", "cleaning.deep-clean"],
    extensions: ["cleaning.residential.ui"],
    featureFlags: { "residential.eco-friendly": true, "residential.pets": true, "residential.supplies-included": true },
  },
}).register((host) => {
  host
    .registerCapability(routineCleanCapability)
    .registerCapability(deepCleanCapability)
    .registerIntentType(bookCleaningIntent)
    .registerIntentType(requestDeepCleanIntent)
    .registerRule(certifiedCleanerRule)
    .registerRule(chemicalCompatibleRule)
    .registerRule(equipmentAvailableRule)
    .registerPolicy(definePolicy({
      id: "cleaning.policy.residential-safety",
      version: "1.0.0",
      name: "Residential Safety Requirements",
      scope: "tenant",
      ruleIds: ["cleaning.rule.certified-cleaner", "cleaning.rule.chemical-compatible"],
      priority: 200,
      effect: "deny",
      description: "Enforce safety: certified cleaners only, chemical compatibility checked.",
    }))
    .registerWorkflow(defineWorkflow({
      id: "cleaning.workflow.residential",
      version: "1.0.0",
      name: "Residential Cleaning Flow",
      stages: [
        { id: "book", name: "Book", order: 10, gateRuleIds: [] },
        { id: "assign", name: "Assign Cleaner", order: 20, gateRuleIds: ["cleaning.rule.certified-cleaner"] },
        { id: "validate", name: "Validate Chemicals", order: 30, gateRuleIds: ["cleaning.rule.chemical-compatible"] },
        { id: "execute", name: "Clean", order: 40, gateRuleIds: [] },
        { id: "inspect", name: "Inspect", order: 50, gateRuleIds: [] },
        { id: "complete", name: "Complete", order: 60, gateRuleIds: [] },
      ],
      triggerIntentTypes: ["cleaning.book", "cleaning.deep-clean"],
      description: "Book → Assign → Validate → Clean → Inspect → Complete",
    }))
    .registerCompilerStage(chemicalCompatibilityStage)
    .registerReadModel(cleaningHistoryReadModel);
});

// ── 2. Commercial Cleaning Protocol ─────────────────────────────────────────

export const commercialProtocol = defineProtocol({
  manifest: {
    id: "cleaning.protocol.commercial",
    version: "1.0.0",
    name: "commercial-cleaning",
    displayName: "Commercial Cleaning",
    description: "Commercial cleaning — offices, retail, warehouses. Recurring contracts, compliance reporting.",
    apiVersion: "1.0.0",
    author: { name: "Eks Group" },
    license: "Commercial",
    minimumKernelVersion: "1.0.0",
    dependencies: [],
    permissions: [{ kind: "compiler-stage", scope: "validate", description: "Chemical compatibility checker" }],
    capabilities: ["cleaning.routine", "cleaning.deep-clean"],
    intentTypes: ["cleaning.book", "cleaning.deep-clean"],
    extensions: ["cleaning.commercial.ui"],
    featureFlags: { "commercial.recurring": true, "commercial.compliance-reporting": true, "commercial.night-shift": true },
  },
}).register((host) => {
  host
    .registerCapability(routineCleanCapability)
    .registerCapability(deepCleanCapability)
    .registerIntentType(bookCleaningIntent)
    .registerRule(certifiedCleanerRule)
    .registerRule(chemicalCompatibleRule)
    .registerRule(equipmentAvailableRule)
    .registerPolicy(definePolicy({
      id: "cleaning.policy.commercial-quality",
      version: "1.0.0",
      name: "Commercial Quality Standards",
      scope: "tenant",
      ruleIds: ["cleaning.rule.certified-cleaner", "cleaning.rule.chemical-compatible", "cleaning.rule.equipment-available"],
      priority: 200,
      effect: "deny",
      description: "Enforce CIMS quality standards for commercial cleaning.",
    }))
    .registerWorkflow(defineWorkflow({
      id: "cleaning.workflow.commercial",
      version: "1.0.0",
      name: "Commercial Cleaning Flow",
      stages: [
        { id: "contract", name: "Contract", order: 10, gateRuleIds: [] },
        { id: "schedule", name: "Schedule", order: 20, gateRuleIds: [] },
        { id: "assign", name: "Assign Team", order: 30, gateRuleIds: ["cleaning.rule.certified-cleaner"] },
        { id: "validate", name: "Validate", order: 40, gateRuleIds: ["cleaning.rule.chemical-compatible"] },
        { id: "execute", name: "Clean", order: 50, gateRuleIds: [] },
        { id: "inspect", name: "Inspect", order: 60, gateRuleIds: [] },
        { id: "report", name: "Report", order: 70, gateRuleIds: [] },
      ],
      triggerIntentTypes: ["cleaning.book"],
      description: "Contract → Schedule → Assign → Validate → Clean → Inspect → Report",
    }))
    .registerCompilerStage(chemicalCompatibilityStage)
    .registerReadModel(cleaningHistoryReadModel);
});

// ── 3. Hospital Cleaning Protocol ───────────────────────────────────────────

export const hospitalProtocol = defineProtocol({
  manifest: {
    id: "cleaning.protocol.hospital",
    version: "1.0.0",
    name: "hospital-cleaning",
    displayName: "Hospital Cleaning",
    description: "Healthcare cleaning — terminal disinfection, bloodborne pathogen handling, EPA-registered disinfectants.",
    apiVersion: "1.0.0",
    author: { name: "Eks Group" },
    license: "Commercial",
    minimumKernelVersion: "1.0.0",
    dependencies: [],
    permissions: [{ kind: "compiler-stage", scope: "validate", description: "Chemical compatibility checker" }],
    capabilities: ["cleaning.routine", "cleaning.deep-clean", "cleaning.disinfect"],
    intentTypes: ["cleaning.book", "cleaning.deep-clean"],
    extensions: ["cleaning.hospital.ui"],
    featureFlags: { "hospital.terminal-disinfection": true, "hospital.bloodborne-pathogen": true, "hospital.epa-list-n": true },
  },
}).register((host) => {
  host
    .registerCapability(routineCleanCapability)
    .registerCapability(deepCleanCapability)
    .registerCapability(disinfectCapability)
    .registerIntentType(bookCleaningIntent)
    .registerIntentType(requestDeepCleanIntent)
    .registerRule(certifiedCleanerRule)
    .registerRule(chemicalCompatibleRule)
    .registerRule(equipmentAvailableRule)
    .registerPolicy(definePolicy({
      id: "cleaning.policy.hospital-compliance",
      version: "1.0.0",
      name: "Hospital Compliance Requirements",
      scope: "tenant",
      ruleIds: ["cleaning.rule.certified-cleaner", "cleaning.rule.chemical-compatible", "cleaning.rule.equipment-available"],
      priority: 300,
      effect: "deny",
      description: "Enforce healthcare disinfection standards (EPA List N, bloodborne pathogen protocols).",
    }))
    .registerWorkflow(defineWorkflow({
      id: "cleaning.workflow.hospital",
      version: "1.0.0",
      name: "Hospital Cleaning Flow",
      stages: [
        { id: "request", name: "Request", order: 10, gateRuleIds: [] },
        { id: "assess", name: "Assess Risk", order: 20, gateRuleIds: [] },
        { id: "assign", name: "Assign", order: 30, gateRuleIds: ["cleaning.rule.certified-cleaner"] },
        { id: "validate", name: "Validate Chemicals", order: 40, gateRuleIds: ["cleaning.rule.chemical-compatible"] },
        { id: "pre-disinfect", name: "Pre-Disinfect", order: 50, gateRuleIds: [] },
        { id: "clean", name: "Clean", order: 60, gateRuleIds: [] },
        { id: "terminal-disinfect", name: "Terminal Disinfection", order: 70, gateRuleIds: [] },
        { id: "inspect", name: "Inspect", order: 80, gateRuleIds: [] },
        { id: "document", name: "Document", order: 90, gateRuleIds: [] },
      ],
      triggerIntentTypes: ["cleaning.book", "cleaning.deep-clean"],
      description: "Request → Assess → Assign → Validate → Pre-Disinfect → Clean → Terminal Disinfect → Inspect → Document",
    }))
    .registerCompilerStage(chemicalCompatibilityStage)
    .registerReadModel(cleaningHistoryReadModel);
});

// ── All Protocols ───────────────────────────────────────────────────────────

export const cleaningProtocols = [residentialProtocol, commercialProtocol, hospitalProtocol];
