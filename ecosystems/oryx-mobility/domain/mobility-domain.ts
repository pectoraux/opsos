/**
 * Oryx Mobility Ecosystem — Domain Definition
 *
 * Defines the semantic model for mobility: what entities exist, how they
 * relate, what states they pass through, and what measurements matter.
 *
 * This is a Domain Definition (semantics) — NOT a Protocol (behavior).
 * Multiple mobility protocols (ride, parcel, rental, corporate) can share
 * this domain. Built entirely on the frozen OpsOS Domain Modeling Framework.
 *
 * IMPORTANT: This file imports ONLY from @kernel/api/v1. It does NOT modify
 * any platform code. It registers extensions through the Protocol SDK.
 */

import {
  defineDomain,
  defineEntityType,
  defineRelationship,
  defineStateMachine,
  defineMeasurement,
  defineConstraint,
} from "@kernel/api/v1";

// ── Entity Types ────────────────────────────────────────────────────────────

const passengerType = defineEntityType({
  id: "passenger",
  name: "Passenger",
  displayName: "Passenger",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "phone", type: "string", required: true },
    { name: "rating", type: "number", required: false, default: 5.0 },
    { name: "paymentMethodRef", type: "string", required: true },
  ],
  relationships: ["passenger-requests-mobility"],
  stateMachineId: "passenger-lifecycle",
  twinEnabled: true,
  resourceBindings: [],
  description: "A person requesting mobility services.",
});

const driverType = defineEntityType({
  id: "driver",
  name: "Driver",
  displayName: "Driver",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "phone", type: "string", required: true },
    { name: "rating", type: "number", required: false, default: 5.0 },
    { name: "status", type: "enum", required: true, enumValues: ["online", "offline", "busy", "on-trip"] },
    { name: "vehicleId", type: "reference", required: false, referenceEntityType: "vehicle" },
    { name: "providerType", type: "enum", required: true, enumValues: ["platform", "partner-fleet", "third-party", "corporate", "autonomous"] },
    { name: "certifications", type: "string", required: false },
  ],
  relationships: ["driver-operates-vehicle", "driver-accepts-trip"],
  stateMachineId: "driver-lifecycle",
  twinEnabled: true,
  resourceBindings: [{ resourceType: "human", capabilityType: "mobility.drive" }],
  description: "A driver providing mobility services. May be platform, partner, third-party, corporate, or autonomous.",
});

const vehicleType = defineEntityType({
  id: "vehicle",
  name: "Vehicle",
  displayName: "Vehicle",
  attributes: [
    { name: "plate", type: "string", required: true },
    { name: "model", type: "string", required: true },
    { name: "capacity", type: "number", required: true, default: 4 },
    { name: "fuelType", type: "enum", required: true, enumValues: ["petrol", "diesel", "electric", "hybrid", "hydrogen"] },
    { name: "status", type: "enum", required: true, enumValues: ["available", "in-use", "maintenance", "offline"] },
    { name: "location", type: "location", required: false },
    { name: "providerType", type: "enum", required: true, enumValues: ["platform", "partner-fleet", "third-party", "corporate", "autonomous"] },
  ],
  relationships: ["vehicle-assigned-to-trip"],
  stateMachineId: "vehicle-lifecycle",
  twinEnabled: true,
  resourceBindings: [{ resourceType: "vehicle", capabilityType: "mobility.transport" }],
  description: "A vehicle available for mobility services. Supports all fuel types including electric.",
});

const tripType = defineEntityType({
  id: "trip",
  name: "Trip",
  displayName: "Trip",
  attributes: [
    { name: "passengerId", type: "reference", required: true, referenceEntityType: "passenger" },
    { name: "driverId", type: "reference", required: false, referenceEntityType: "driver" },
    { name: "vehicleId", type: "reference", required: false, referenceEntityType: "vehicle" },
    { name: "origin", type: "location", required: true },
    { name: "destination", type: "location", required: true },
    { name: "route", type: "string", required: false },
    { name: "fare", type: "number", required: false },
    { name: "currency", type: "string", required: false, default: "USD" },
    { name: "eta", type: "number", required: false },
    { name: "distance", type: "measurement", required: false, measurementMetric: "distance" },
    { name: "duration", type: "measurement", required: false, measurementMetric: "duration" },
    { name: "providerType", type: "enum", required: false, enumValues: ["platform", "partner-fleet", "third-party", "corporate", "autonomous"] },
    { name: "tripType", type: "enum", required: true, enumValues: ["ride", "parcel", "rental", "corporate", "emergency", "school", "airport"] },
  ],
  relationships: ["trip-has-driver", "trip-has-vehicle", "trip-has-parcel"],
  stateMachineId: "trip-lifecycle",
  twinEnabled: true,
  resourceBindings: [],
  description: "A mobility trip from origin to destination. Unified across ride, parcel, rental, corporate, etc.",
});

const parcelType = defineEntityType({
  id: "parcel",
  name: "Parcel",
  displayName: "Parcel",
  attributes: [
    { name: "description", type: "string", required: true },
    { name: "weight", type: "measurement", required: true, measurementMetric: "weight" },
    { name: "dimensions", type: "string", required: false },
    { name: "pickupLocation", type: "location", required: true },
    { name: "deliveryLocation", type: "location", required: true },
    { name: "fragile", type: "boolean", required: false, default: false },
    { name: "insured", type: "boolean", required: false, default: false },
  ],
  relationships: ["parcel-assigned-to-trip"],
  stateMachineId: "parcel-lifecycle",
  twinEnabled: true,
  resourceBindings: [],
  description: "A parcel for delivery through the mobility marketplace.",
});

const mobilityIntentType = defineEntityType({
  id: "mobility-intent",
  name: "MobilityIntent",
  displayName: "Mobility Intent",
  attributes: [
    { name: "passengerId", type: "reference", required: true, referenceEntityType: "passenger" },
    { name: "origin", type: "location", required: true },
    { name: "destination", type: "location", required: true },
    { name: "intentType", type: "enum", required: true, enumValues: ["transport-passenger", "deliver-parcel", "reserve-vehicle", "rent-vehicle", "recurring-transport", "move-fleet", "emergency-response", "corporate-transport"] },
    { name: "scheduledFor", type: "number", required: false },
    { name: "preferences", type: "string", required: false },
    { name: "budget", type: "number", required: false },
    { name: "currency", type: "string", required: false, default: "USD" },
  ],
  relationships: ["intent-creates-trip"],
  stateMachineId: "intent-lifecycle",
  twinEnabled: false,
  resourceBindings: [],
  description: "A mobility intent — the universal primitive. Not rides, not parcels, not bookings. Mobility.",
});

// ── Relationships ───────────────────────────────────────────────────────────

const relationships = [
  defineRelationship({
    id: "passenger-requests-mobility",
    name: "requests",
    sourceEntityType: "passenger",
    targetEntityType: "mobility-intent",
    kind: "produces",
    cardinality: "one-to-many",
    bidirectional: false,
  }),
  defineRelationship({
    id: "driver-operates-vehicle",
    name: "operates",
    sourceEntityType: "driver",
    targetEntityType: "vehicle",
    kind: "assigned_to",
    cardinality: "one-to-one",
    bidirectional: true,
    inverseName: "operated_by",
  }),
  defineRelationship({
    id: "driver-accepts-trip",
    name: "accepts",
    sourceEntityType: "driver",
    targetEntityType: "trip",
    kind: "assigned_to",
    cardinality: "one-to-many",
    bidirectional: true,
    inverseName: "driven_by",
  }),
  defineRelationship({
    id: "vehicle-assigned-to-trip",
    name: "assigned_to",
    sourceEntityType: "vehicle",
    targetEntityType: "trip",
    kind: "assigned_to",
    cardinality: "one-to-many",
    bidirectional: true,
    inverseName: "uses_vehicle",
  }),
  defineRelationship({
    id: "trip-has-driver",
    name: "has_driver",
    sourceEntityType: "trip",
    targetEntityType: "driver",
    kind: "depends_on",
    cardinality: "many-to-many",
    bidirectional: false,
  }),
  defineRelationship({
    id: "trip-has-vehicle",
    name: "has_vehicle",
    sourceEntityType: "trip",
    targetEntityType: "vehicle",
    kind: "depends_on",
    cardinality: "many-to-many",
    bidirectional: false,
  }),
  defineRelationship({
    id: "trip-has-parcel",
    name: "has_parcel",
    sourceEntityType: "trip",
    targetEntityType: "parcel",
    kind: "produces",
    cardinality: "one-to-one",
    bidirectional: false,
  }),
  defineRelationship({
    id: "parcel-assigned-to-trip",
    name: "assigned_to_trip",
    sourceEntityType: "parcel",
    targetEntityType: "trip",
    kind: "assigned_to",
    cardinality: "one-to-one",
    bidirectional: false,
  }),
  defineRelationship({
    id: "intent-creates-trip",
    name: "creates",
    sourceEntityType: "mobility-intent",
    targetEntityType: "trip",
    kind: "produces",
    cardinality: "one-to-many",
    bidirectional: false,
  }),
];

// ── State Machines ──────────────────────────────────────────────────────────

const tripLifecycle = defineStateMachine({
  id: "trip-lifecycle",
  name: "Trip Lifecycle",
  states: ["requested", "matching", "matched", "negotiating", "negotiated", "en-route-pickup", "passenger-boarded", "in-trip", "arriving", "completed", "cancelled", "failed"],
  transitions: [
    { from: "requested", to: "matching" },
    { from: "matching", to: "matched" },
    { from: "matching", to: "failed" },
    { from: "matched", to: "negotiating" },
    { from: "matched", to: "en-route-pickup" },
    { from: "negotiating", to: "negotiated" },
    { from: "negotiating", to: "failed" },
    { from: "negotiated", to: "en-route-pickup" },
    { from: "en-route-pickup", to: "passenger-boarded" },
    { from: "en-route-pickup", to: "cancelled" },
    { from: "passenger-boarded", to: "in-trip" },
    { from: "in-trip", to: "arriving" },
    { from: "arriving", to: "completed" },
    { from: "requested", to: "cancelled" },
    { from: "matching", to: "cancelled" },
    { from: "matched", to: "cancelled" },
  ],
  initial: "requested",
  terminal: ["completed", "cancelled", "failed"],
});

const driverLifecycle = defineStateMachine({
  id: "driver-lifecycle",
  name: "Driver Lifecycle",
  states: ["offline", "online", "searching", "assigned", "on-trip", "break"],
  transitions: [
    { from: "offline", to: "online" },
    { from: "online", to: "searching" },
    { from: "searching", to: "assigned" },
    { from: "assigned", to: "on-trip" },
    { from: "on-trip", to: "searching" },
    { from: "on-trip", to: "break" },
    { from: "break", to: "online" },
    { from: "online", to: "offline" },
    { from: "searching", to: "online" },
  ],
  initial: "offline",
  terminal: ["offline"],
});

const vehicleLifecycle = defineStateMachine({
  id: "vehicle-lifecycle",
  name: "Vehicle Lifecycle",
  states: ["available", "reserved", "in-use", "maintenance", "offline"],
  transitions: [
    { from: "available", to: "reserved" },
    { from: "reserved", to: "in-use" },
    { from: "in-use", to: "available" },
    { from: "available", to: "maintenance" },
    { from: "maintenance", to: "available" },
    { from: "available", to: "offline" },
    { from: "offline", to: "available" },
    { from: "reserved", to: "available" },
  ],
  initial: "available",
  terminal: ["offline"],
});

const parcelLifecycle = defineStateMachine({
  id: "parcel-lifecycle",
  name: "Parcel Lifecycle",
  states: ["published", "bidding", "awarded", "picked-up", "in-transit", "delivered", "failed"],
  transitions: [
    { from: "published", to: "bidding" },
    { from: "bidding", to: "awarded" },
    { from: "bidding", to: "failed" },
    { from: "awarded", to: "picked-up" },
    { from: "picked-up", to: "in-transit" },
    { from: "in-transit", to: "delivered" },
    { from: "in-transit", to: "failed" },
    { from: "published", to: "failed" },
  ],
  initial: "published",
  terminal: ["delivered", "failed"],
});

const intentLifecycle = defineStateMachine({
  id: "intent-lifecycle",
  name: "Intent Lifecycle",
  states: ["declared", "compiling", "compiled", "matching", "matched", "executing", "satisfied", "abandoned"],
  transitions: [
    { from: "declared", to: "compiling" },
    { from: "compiling", to: "compiled" },
    { from: "compiling", to: "abandoned" },
    { from: "compiled", to: "matching" },
    { from: "matching", to: "matched" },
    { from: "matching", to: "abandoned" },
    { from: "matched", to: "executing" },
    { from: "executing", to: "satisfied" },
    { from: "executing", to: "abandoned" },
  ],
  initial: "declared",
  terminal: ["satisfied", "abandoned"],
});

const passengerLifecycle = defineStateMachine({
  id: "passenger-lifecycle",
  name: "Passenger Lifecycle",
  states: ["registered", "active", "suspended", "banned"],
  transitions: [
    { from: "registered", to: "active" },
    { from: "active", to: "suspended" },
    { from: "suspended", to: "active" },
    { from: "suspended", to: "banned" },
    { from: "active", to: "banned" },
  ],
  initial: "registered",
  terminal: ["banned"],
});

// ── Measurements ────────────────────────────────────────────────────────────

const measurements = [
  defineMeasurement({ metric: "distance", unit: "m", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "duration", unit: "s", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "weight", unit: "kg", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "fare", unit: "USD", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "eta", unit: "s", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "speed", unit: "m/s", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "rating", unit: "stars", valueType: "number", min: 0, max: 5 }),
];

// ── Constraints ─────────────────────────────────────────────────────────────

const constraints = [
  defineConstraint({
    id: "trip-must-have-passenger",
    kind: "must_have",
    targetEntityType: "trip",
    attributeRef: "passengerId",
    params: {},
  }),
  defineConstraint({
    id: "trip-must-have-origin-destination",
    kind: "must_have",
    targetEntityType: "trip",
    attributeRef: "origin",
    params: {},
  }),
  defineConstraint({
    id: "driver-must-have-valid-status",
    kind: "must_have",
    targetEntityType: "driver",
    attributeRef: "status",
    params: {},
  }),
  defineConstraint({
    id: "parcel-must-have-weight",
    kind: "must_have",
    targetEntityType: "parcel",
    attributeRef: "weight",
    params: {},
  }),
];

// ── The Domain Definition ───────────────────────────────────────────────────

export const oryxMobilityDomain = defineDomain({
  id: "oryx.domain.mobility",
  name: "mobility",
  version: 1,
  displayName: "Oryx Mobility Domain",
  description: "Universal mobility domain — passengers, drivers, vehicles, trips, parcels, and mobility intents. Supports ride, parcel, rental, corporate, emergency, school, and airport transport.",
  entityTypes: [passengerType, driverType, vehicleType, tripType, parcelType, mobilityIntentType],
  relationships,
  stateMachines: [tripLifecycle, driverLifecycle, vehicleLifecycle, parcelLifecycle, intentLifecycle, passengerLifecycle],
  measurements,
  constraints,
  ownerProtocolId: "oryx.protocol.mobility",
});

export default oryxMobilityDomain;
