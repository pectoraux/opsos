/**
 * Oryx Mobility Protocol — the behavior layer.
 *
 * Registers capabilities, intent types, workflows, policies, knowledge,
 * compiler extensions, and marketplace strategies through the Protocol SDK.
 *
 * IMPORTANT: This file imports ONLY from @kernel/api/v1. It does NOT modify
 * any platform code. It registers extensions through the Protocol SDK.
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

// ── Capabilities ────────────────────────────────────────────────────────────

const driveCapability = defineCapability({
  id: "oryx.cap.drive",
  capabilityType: "mobility.drive",
  version: "1.0.0",
  inputs: [
    { name: "origin", schema: { ref: "oryx.location", version: 1 }, required: true },
    { name: "destination", schema: { ref: "oryx.location", version: 1 }, required: true },
  ],
  outputs: [
    { name: "trip", schema: { ref: "oryx.trip", version: 1 }, required: true },
  ],
  tags: ["mobility", "ride", "transport"],
  description: "Transport a passenger from origin to destination.",
});

const deliverCapability = defineCapability({
  id: "oryx.cap.deliver",
  capabilityType: "mobility.deliver",
  version: "1.0.0",
  inputs: [
    { name: "pickup", schema: { ref: "oryx.location", version: 1 }, required: true },
    { name: "dropoff", schema: { ref: "oryx.location", version: 1 }, required: true },
    { name: "parcel", schema: { ref: "oryx.parcel", version: 1 }, required: true },
  ],
  outputs: [
    { name: "delivery", schema: { ref: "oryx.delivery", version: 1 }, required: true },
  ],
  tags: ["mobility", "parcel", "delivery"],
  description: "Deliver a parcel from pickup to dropoff through the marketplace.",
});

const reserveCapability = defineCapability({
  id: "oryx.cap.reserve",
  capabilityType: "mobility.reserve",
  version: "1.0.0",
  inputs: [
    { name: "vehicleType", schema: { ref: "oryx.vehicle-type", version: 1 }, required: true },
    { name: "startTime", schema: { ref: "oryx.timestamp", version: 1 }, required: true },
    { name: "duration", schema: { ref: "oryx.duration", version: 1 }, required: true },
  ],
  outputs: [
    { name: "reservation", schema: { ref: "oryx.reservation", version: 1 }, required: true },
  ],
  tags: ["mobility", "rental", "reservation"],
  description: "Reserve a vehicle for a specified duration.",
});

// ── Intent Types ────────────────────────────────────────────────────────────

const transportPassengerIntent = defineIntent({
  intentType: "oryx.mobility.transport-passenger",
  version: "1.0.0",
  payloadSchema: { ref: "oryx.mobility.transport-passenger.payload", version: 1 },
  validation: [],
  requiredCapabilities: [
    { capabilityType: "mobility.drive", quantity: { amount: 1, unit: "trip" }, constraints: [] },
  ],
  description: "Transport a passenger from origin to destination. Evaluates ALL providers.",
});

const deliverParcelIntent = defineIntent({
  intentType: "oryx.mobility.deliver-parcel",
  version: "1.0.0",
  payloadSchema: { ref: "oryx.mobility.deliver-parcel.payload", version: 1 },
  validation: [],
  requiredCapabilities: [
    { capabilityType: "mobility.deliver", quantity: { amount: 1, unit: "delivery" }, constraints: [] },
  ],
  description: "Publish a parcel delivery intent into the marketplace. Couriers bid; best execution plan wins.",
});

const reserveVehicleIntent = defineIntent({
  intentType: "oryx.mobility.reserve-vehicle",
  version: "1.0.0",
  payloadSchema: { ref: "oryx.mobility.reserve-vehicle.payload", version: 1 },
  validation: [],
  requiredCapabilities: [
    { capabilityType: "mobility.reserve", quantity: { amount: 1, unit: "reservation" }, constraints: [] },
  ],
  description: "Reserve a vehicle for future use.",
});

// ── Policies ────────────────────────────────────────────────────────────────

const marketplacePolicy = definePolicy({
  id: "oryx.policy.marketplace-first",
  version: "1.0.0",
  name: "Marketplace First",
  scope: "tenant",
  ruleIds: ["oryx.rule.evaluate-all-providers"],
  priority: 100,
  effect: "allow",
  description: "Every mobility intent MUST be evaluated against ALL providers in the marketplace.",
});

const safetyPolicy = definePolicy({
  id: "oryx.policy.safety",
  version: "1.0.0",
  name: "Safety Requirements",
  scope: "tenant",
  ruleIds: ["oryx.rule.driver-certified", "oryx.rule.vehicle-inspected"],
  priority: 200,
  effect: "deny",
  description: "Deny trips with uncertified drivers or uninspected vehicles.",
});

const budgetPolicy = definePolicy({
  id: "oryx.policy.budget-respect",
  version: "1.0.0",
  name: "Budget Respect",
  scope: "tenant",
  ruleIds: ["oryx.rule.fare-within-budget"],
  priority: 50,
  effect: "allow",
  description: "Prefer offers within the passenger's declared budget.",
});

// ── Rules ───────────────────────────────────────────────────────────────────

const evaluateAllProvidersRule = defineRule({
  id: "oryx.rule.evaluate-all-providers",
  name: "Evaluate All Providers",
  condition: { op: "exists", args: ["intentType"] },
  effect: "allow",
  priority: 100,
  scope: "tenant",
  description: "Always allow evaluation of all providers (platform, partner, third-party, corporate, autonomous).",
});

const driverCertifiedRule = defineRule({
  id: "oryx.rule.driver-certified",
  name: "Driver Must Be Certified",
  condition: { op: "eq", args: ["driver.certified", false] },
  effect: "deny",
  priority: 200,
  scope: "tenant",
  description: "Deny if driver is not certified.",
});

const vehicleInspectedRule = defineRule({
  id: "oryx.rule.vehicle-inspected",
  name: "Vehicle Must Be Inspected",
  condition: { op: "eq", args: ["vehicle.inspected", false] },
  effect: "deny",
  priority: 200,
  scope: "tenant",
  description: "Deny if vehicle has not been inspected.",
});

const fareWithinBudgetRule = defineRule({
  id: "oryx.rule.fare-within-budget",
  name: "Fare Within Budget",
  condition: { op: "lte", args: ["fare", "budget"] },
  effect: "allow",
  priority: 50,
  scope: "tenant",
  description: "Prefer fares within the passenger's budget.",
});

// ── Workflows ───────────────────────────────────────────────────────────────

const bookingWorkflow = defineWorkflow({
  id: "oryx.workflow.booking",
  version: "1.0.0",
  name: "Mobility Booking Flow",
  stages: [
    { id: "search", name: "Search", order: 10, gateRuleIds: [] },
    { id: "compile", name: "Compile", order: 20, gateRuleIds: [] },
    { id: "marketplace", name: "Marketplace", order: 30, gateRuleIds: ["oryx.rule.evaluate-all-providers"] },
    { id: "negotiate", name: "Negotiate", order: 40, gateRuleIds: [] },
    { id: "recommend", name: "Recommend", order: 50, gateRuleIds: [] },
    { id: "confirm", name: "Confirm", order: 60, gateRuleIds: ["oryx.rule.driver-certified", "oryx.rule.vehicle-inspected"] },
    { id: "execute", name: "Execute", order: 70, gateRuleIds: [] },
    { id: "track", name: "Track", order: 80, gateRuleIds: [] },
    { id: "settle", name: "Settle", order: 90, gateRuleIds: [] },
  ],
  triggerIntentTypes: [
    "oryx.mobility.transport-passenger",
    "oryx.mobility.deliver-parcel",
    "oryx.mobility.reserve-vehicle",
  ],
  description: "The full booking flow: Search → Compile → Marketplace → Negotiate → Recommend → Confirm → Execute → Track → Settle.",
});

const parcelBiddingWorkflow = defineWorkflow({
  id: "oryx.workflow.parcel-bidding",
  version: "1.0.0",
  name: "Parcel Bidding Flow",
  stages: [
    { id: "publish", name: "Publish", order: 10, gateRuleIds: [] },
    { id: "bidding", name: "Bidding", order: 20, gateRuleIds: [] },
    { id: "evaluate", name: "Evaluate Bids", order: 30, gateRuleIds: ["oryx.rule.evaluate-all-providers"] },
    { id: "award", name: "Award", order: 40, gateRuleIds: [] },
    { id: "pickup", name: "Pickup", order: 50, gateRuleIds: [] },
    { id: "transit", name: "Transit", order: 60, gateRuleIds: [] },
    { id: "deliver", name: "Deliver", order: 70, gateRuleIds: [] },
  ],
  triggerIntentTypes: ["oryx.mobility.deliver-parcel"],
  description: "Parcel publishing → live bidding → evaluation → award → pickup → transit → delivery.",
});

// ── Compiler Extensions ─────────────────────────────────────────────────────

const marketplaceAggregationStage = defineCompilerStage({
  name: "oryx.marketplace-aggregator",
  version: "1.0.0",
  phase: "resolve",
  order: 15,
  insertion: "after-kernel-phase",
  dependsOn: ["kernel.capability-resolver"],
  stageRef: "oryx.marketplace-aggregator.stage",
  description: "Aggregates ALL providers (platform, partner, third-party, corporate, autonomous) into a single ranked list.",
});

const negotiationStage = defineCompilerStage({
  name: "oryx.auto-negotiator",
  version: "1.0.0",
  phase: "plan",
  order: 15,
  insertion: "after-kernel-phase",
  dependsOn: ["kernel.planner"],
  stageRef: "oryx.auto-negotiator.stage",
  description: "Automatically negotiates with providers (counter-offers, dynamic pricing, pooling, fleet discounts, corporate rates, subscription benefits).",
});

const explainabilityStage = defineCompilerStage({
  name: "oryx.explainability",
  version: "1.0.0",
  phase: "finalize",
  order: 5,
  insertion: "before-kernel-phase",
  dependsOn: [],
  stageRef: "oryx.explainability.stage",
  description: "Generates human-readable explanations for every recommendation: Why this provider? Why this price? Why not Uber? Why pooling? Why this ETA? Why this route?",
});

// ── Read Models ─────────────────────────────────────────────────────────────

const tripHistoryReadModel = defineReadModel({
  id: "oryx.readmodel.trip-history",
  version: "1.0.0",
  name: "Trip History",
  sourceEventTypes: ["TripRequested", "TripMatched", "TripCompleted", "TripCancelled"],
  targetSchema: { ref: "oryx.trip-history", version: 1 },
  transformRef: "oryx.readmodel.trip-history.transform",
  description: "Projection of trip history for passengers and drivers.",
});

const marketplaceActivityReadModel = defineReadModel({
  id: "oryx.readmodel.marketplace-activity",
  version: "1.0.0",
  name: "Marketplace Activity",
  sourceEventTypes: ["BidSubmitted", "BidAccepted", "BidRejected", "MarketplaceCleared"],
  targetSchema: { ref: "oryx.marketplace-activity", version: 1 },
  transformRef: "oryx.readmodel.marketplace-activity.transform",
  description: "Live projection of marketplace bidding activity.",
});

// ── The Protocol ────────────────────────────────────────────────────────────

export const oryxMobilityProtocol = defineProtocol({
  manifest: {
    id: "oryx.protocol.mobility",
    version: "1.0.0",
    name: "oryx-mobility",
    displayName: "Oryx Mobility",
    description: "Universal mobility protocol — ride aggregation, parcel marketplace, automatic negotiation, multi-provider comparison. Passengers buy mobility, not rides.",
    apiVersion: "1.0.0",
    author: { name: "Oryx", url: "https://oryx.mobility" },
    license: "Commercial",
    homepage: "https://oryx.mobility",
    icon: "oryx",
    minimumKernelVersion: "1.0.0",
    dependencies: [],
    permissions: [
      { kind: "compiler-stage", scope: "resolve", description: "Marketplace aggregation stage" },
      { kind: "compiler-stage", scope: "plan", description: "Auto-negotiation stage" },
      { kind: "compiler-stage", scope: "finalize", description: "Explainability stage" },
      { kind: "read-model", scope: "trip-history", description: "Trip history projection" },
      { kind: "read-model", scope: "marketplace-activity", description: "Marketplace activity projection" },
    ],
    capabilities: ["mobility.drive", "mobility.deliver", "mobility.reserve"],
    intentTypes: ["oryx.mobility.transport-passenger", "oryx.mobility.deliver-parcel", "oryx.mobility.reserve-vehicle"],
    extensions: ["oryx.marketplace", "oryx.parcel-bidding", "oryx.tracking"],
    featureFlags: {
      "oryx.ride-aggregation": true,
      "oryx.parcel-marketplace": true,
      "oryx.auto-negotiation": true,
      "oryx.explainability": true,
      "oryx.pooled-rides": true,
      "oryx.corporate-rates": true,
      "oryx.subscription-benefits": true,
      "oryx.autonomous-fleet": false,
    },
  },
}).register((host) => {
  host
    // Capabilities
    .registerCapability(driveCapability)
    .registerCapability(deliverCapability)
    .registerCapability(reserveCapability)
    // Intent types
    .registerIntentType(transportPassengerIntent)
    .registerIntentType(deliverParcelIntent)
    .registerIntentType(reserveVehicleIntent)
    // Rules + Policies
    .registerRule(evaluateAllProvidersRule)
    .registerRule(driverCertifiedRule)
    .registerRule(vehicleInspectedRule)
    .registerRule(fareWithinBudgetRule)
    .registerPolicy(marketplacePolicy)
    .registerPolicy(safetyPolicy)
    .registerPolicy(budgetPolicy)
    // Workflows
    .registerWorkflow(bookingWorkflow)
    .registerWorkflow(parcelBiddingWorkflow)
    // Compiler extensions (never replace kernel stages — only extend)
    .registerCompilerStage(marketplaceAggregationStage)
    .registerCompilerStage(negotiationStage)
    .registerCompilerStage(explainabilityStage)
    // Read models
    .registerReadModel(tripHistoryReadModel)
    .registerReadModel(marketplaceActivityReadModel);
});

export default oryxMobilityProtocol;
