/**
 * Cleaning Domain — semantic model of reality.
 *
 * NO workflows. NO UI. NO AI. Only semantics: entities, relationships,
 * state machines, measurements, constraints.
 *
 * Built using defineDomain/defineEntityType/defineRelationship/etc. from
 * @kernel/api/v1. The frozen platform is not modified.
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

const buildingType = defineEntityType({
  id: "building",
  name: "Building",
  displayName: "Building",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "address", type: "string", required: true },
    { name: "floors", type: "number", required: false, default: 1 },
    { name: "type", type: "enum", required: true, enumValues: ["residential", "commercial", "industrial", "healthcare", "hospitality", "educational"] },
  ],
  relationships: ["building-contains-area", "building-contains-room"],
  stateMachineId: "building-lifecycle",
  twinEnabled: true,
  resourceBindings: [],
  description: "A physical building containing areas and rooms.",
});

const areaType = defineEntityType({
  id: "area",
  name: "Area",
  displayName: "Area",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "type", type: "enum", required: true, enumValues: ["kitchen", "bathroom", "bedroom", "living-room", "office", "hallway", "lobby", "warehouse", "common-area"] },
    { name: "floor", type: "number", required: false },
    { name: "area", type: "measurement", required: false, measurementMetric: "area" },
  ],
  relationships: ["area-contains-room", "area-located-in-building"],
  stateMachineId: "area-cleanliness",
  twinEnabled: true,
  resourceBindings: [],
  description: "A functional area within a building (kitchen, bathroom, office, etc.)",
});

const roomType = defineEntityType({
  id: "room",
  name: "Room",
  displayName: "Room",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "type", type: "enum", required: true, enumValues: ["bathroom", "bedroom", "kitchen", "office", "conference", "storage", "utility", "lobby", "corridor"] },
    { name: "area", type: "measurement", required: false, measurementMetric: "area" },
    { name: "occupancy", type: "enum", required: false, enumValues: ["vacant", "occupied", "cleaning", "inspecting"] },
  ],
  relationships: ["room-located-in-area", "room-located-in-building"],
  stateMachineId: "room-cleanliness",
  twinEnabled: true,
  resourceBindings: [],
  description: "A specific room within a building or area.",
});

const surfaceType = defineEntityType({
  id: "surface",
  name: "Surface",
  displayName: "Surface",
  attributes: [
    { name: "type", type: "enum", required: true, enumValues: ["floor", "wall", "ceiling", "counter", "window", "door", "fixture", "appliance", "furniture"] },
    { name: "material", type: "enum", required: true, enumValues: ["tile", "wood", "carpet", "concrete", "marble", "granite", "glass", "metal", "plastic", "laminate", "vinyl"] },
    { name: "condition", type: "enum", required: false, enumValues: ["clean", "dirty", "damaged", "stained"] },
    { name: "area", type: "measurement", required: false, measurementMetric: "area" },
  ],
  relationships: ["surface-located-in-room"],
  stateMachineId: "surface-cleanliness",
  twinEnabled: false,
  resourceBindings: [],
  description: "A cleanable surface with material and condition.",
});

const materialType = defineEntityType({
  id: "material",
  name: "Material",
  displayName: "Material",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "type", type: "enum", required: true, enumValues: ["tile", "wood", "carpet", "concrete", "marble", "granite", "glass", "metal", "plastic", "laminate", "vinyl"] },
    { name: "phSensitivity", type: "enum", required: false, enumValues: ["acid-sensitive", "alkali-sensitive", "neutral-only", "any"] },
    { name: "waterSensitivity", type: "enum", required: false, enumValues: ["waterproof", "water-resistant", "water-sensitive", "extreme-care"] },
  ],
  relationships: [],
  twinEnabled: false,
  resourceBindings: [],
  description: "A material with chemical and water sensitivity properties for compatibility checking.",
});

const equipmentType = defineEntityType({
  id: "equipment",
  name: "Equipment",
  displayName: "Equipment",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "type", type: "enum", required: true, enumValues: ["vacuum", "mop", "pressure-washer", "floor-buffer", "steam-cleaner", "scrubber", "sprayer", "squeegee", "other"] },
    { name: "status", type: "enum", required: true, enumValues: ["available", "in-use", "maintenance", "broken"] },
    { name: "lastServiced", type: "number", required: false },
  ],
  relationships: [],
  stateMachineId: "equipment-lifecycle",
  twinEnabled: true,
  resourceBindings: [{ resourceType: "equipment", capabilityType: "cleaning.equipment" }],
  description: "Cleaning equipment with maintenance tracking.",
});

const chemicalType = defineEntityType({
  id: "chemical",
  name: "Chemical",
  displayName: "Chemical",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "type", type: "enum", required: true, enumValues: ["detergent", "disinfectant", "degreaser", "descaler", "deodorizer", "solvent", "acid", "alkali", "neutral"] },
    { name: "ph", type: "number", required: true },
    { name: "dilutionRatio", type: "string", required: false },
    { name: "contactTime", type: "number", required: false },
    { name: "hazardLevel", type: "enum", required: true, enumValues: ["low", "medium", "high", "critical"] },
  ],
  relationships: [],
  twinEnabled: false,
  resourceBindings: [],
  description: "A cleaning chemical with pH, dilution, and hazard properties.",
});

const consumableType = defineEntityType({
  id: "consumable",
  name: "Consumable",
  displayName: "Consumable",
  attributes: [
    { name: "name", type: "string", required: true },
    { name: "type", type: "enum", required: true, enumValues: ["cloth", "paper", "bag", "glove", "brush", "pad", "sponge", "bag-liner"] },
    { name: "quantity", type: "number", required: true, default: 0 },
    { name: "unit", type: "string", required: true, default: "units" },
  ],
  relationships: [],
  twinEnabled: false,
  resourceBindings: [],
  description: "A consumable cleaning supply with inventory tracking.",
});

const cleaningTaskType = defineEntityType({
  id: "cleaning-task",
  name: "CleaningTask",
  displayName: "Cleaning Task",
  attributes: [
    { name: "title", type: "string", required: true },
    { name: "description", type: "string", required: false },
    { name: "taskType", type: "enum", required: true, enumValues: ["routine", "deep-clean", "sanitization", "disinfection", "maintenance", "emergency", "inspection"] },
    { name: "priority", type: "number", required: false, default: 5 },
    { name: "estimatedDuration", type: "measurement", required: false, measurementMetric: "duration" },
    { name: "areaId", type: "reference", required: false, referenceEntityType: "area" },
    { name: "roomId", type: "reference", required: false, referenceEntityType: "room" },
    { name: "surfaceId", type: "reference", required: false, referenceEntityType: "surface" },
  ],
  relationships: ["task-assigned-to-cleaner", "task-requires-equipment", "task-requires-chemical"],
  stateMachineId: "task-lifecycle",
  twinEnabled: true,
  resourceBindings: [],
  description: "A cleaning task targeting a specific area, room, or surface.",
});

const inspectionType = defineEntityType({
  id: "inspection",
  name: "Inspection",
  displayName: "Inspection",
  attributes: [
    { name: "type", type: "enum", required: true, enumValues: ["quality", "safety", "compliance", "routine"] },
    { name: "score", type: "number", required: false },
    { name: "notes", type: "string", required: false },
    { name: "inspectorId", type: "string", required: true },
    { name: "taskId", type: "reference", required: false, referenceEntityType: "cleaning-task" },
  ],
  relationships: ["inspection-for-task"],
  stateMachineId: "inspection-lifecycle",
  twinEnabled: false,
  resourceBindings: [],
  description: "A quality/safety/compliance inspection of a cleaning task.",
});

// ── Relationships ───────────────────────────────────────────────────────────

const relationships = [
  defineRelationship({ id: "building-contains-area", name: "contains", sourceEntityType: "building", targetEntityType: "area", kind: "contains", cardinality: "one-to-many", bidirectional: false }),
  defineRelationship({ id: "building-contains-room", name: "contains", sourceEntityType: "building", targetEntityType: "room", kind: "contains", cardinality: "one-to-many", bidirectional: false }),
  defineRelationship({ id: "area-contains-room", name: "contains", sourceEntityType: "area", targetEntityType: "room", kind: "contains", cardinality: "one-to-many", bidirectional: false }),
  defineRelationship({ id: "area-located-in-building", name: "located_in", sourceEntityType: "area", targetEntityType: "building", kind: "located_in", cardinality: "many-to-many", bidirectional: false }),
  defineRelationship({ id: "room-located-in-area", name: "located_in", sourceEntityType: "room", targetEntityType: "area", kind: "located_in", cardinality: "many-to-many", bidirectional: false }),
  defineRelationship({ id: "room-located-in-building", name: "located_in", sourceEntityType: "room", targetEntityType: "building", kind: "located_in", cardinality: "many-to-many", bidirectional: false }),
  defineRelationship({ id: "surface-located-in-room", name: "located_in", sourceEntityType: "surface", targetEntityType: "room", kind: "located_in", cardinality: "many-to-many", bidirectional: false }),
  defineRelationship({ id: "task-assigned-to-cleaner", name: "assigned_to", sourceEntityType: "cleaning-task", targetEntityType: "cleaning-task", kind: "assigned_to", cardinality: "many-to-many", bidirectional: false }),
  defineRelationship({ id: "task-requires-equipment", name: "requires", sourceEntityType: "cleaning-task", targetEntityType: "equipment", kind: "requires", cardinality: "many-to-many", bidirectional: false }),
  defineRelationship({ id: "task-requires-chemical", name: "requires", sourceEntityType: "cleaning-task", targetEntityType: "chemical", kind: "requires", cardinality: "many-to-many", bidirectional: false }),
  defineRelationship({ id: "inspection-for-task", name: "inspects", sourceEntityType: "inspection", targetEntityType: "cleaning-task", kind: "produces", cardinality: "many-to-many", bidirectional: false }),
];

// ── State Machines ──────────────────────────────────────────────────────────

const taskLifecycle = defineStateMachine({
  id: "task-lifecycle",
  name: "Cleaning Task Lifecycle",
  states: ["pending", "assigned", "accepted", "in-progress", "completed", "inspected", "failed", "cancelled"],
  transitions: [
    { from: "pending", to: "assigned" },
    { from: "assigned", to: "accepted" },
    { from: "assigned", to: "pending" },
    { from: "accepted", to: "in-progress" },
    { from: "in-progress", to: "completed" },
    { from: "in-progress", to: "failed" },
    { from: "completed", to: "inspected" },
    { from: "pending", to: "cancelled" },
    { from: "assigned", to: "cancelled" },
  ],
  initial: "pending",
  terminal: ["inspected", "failed", "cancelled"],
});

const roomCleanliness = defineStateMachine({
  id: "room-cleanliness",
  name: "Room Cleanliness",
  states: ["dirty", "scheduled", "cleaning", "clean", "inspected", "failed-inspection"],
  transitions: [
    { from: "dirty", to: "scheduled" },
    { from: "scheduled", to: "cleaning" },
    { from: "cleaning", to: "clean" },
    { from: "clean", to: "inspected" },
    { from: "inspected", to: "dirty" },
    { from: "inspected", to: "failed-inspection" },
    { from: "failed-inspection", to: "scheduled" },
    { from: "clean", to: "dirty" },
  ],
  initial: "dirty",
  terminal: [],
});

const surfaceCleanliness = defineStateMachine({
  id: "surface-cleanliness",
  name: "Surface Cleanliness",
  states: ["dirty", "cleaning", "clean", "damaged"],
  transitions: [
    { from: "dirty", to: "cleaning" },
    { from: "cleaning", to: "clean" },
    { from: "cleaning", to: "damaged" },
    { from: "clean", to: "dirty" },
    { from: "damaged", to: "cleaning" },
  ],
  initial: "dirty",
  terminal: [],
});

const equipmentLifecycle = defineStateMachine({
  id: "equipment-lifecycle",
  name: "Equipment Lifecycle",
  states: ["available", "in-use", "maintenance", "broken"],
  transitions: [
    { from: "available", to: "in-use" },
    { from: "in-use", to: "available" },
    { from: "in-use", to: "maintenance" },
    { from: "maintenance", to: "available" },
    { from: "maintenance", to: "broken" },
    { from: "broken", to: "maintenance" },
    { from: "available", to: "maintenance" },
  ],
  initial: "available",
  terminal: [],
});

const inspectionLifecycle = defineStateMachine({
  id: "inspection-lifecycle",
  name: "Inspection Lifecycle",
  states: ["scheduled", "in-progress", "passed", "failed", "needs-rework"],
  transitions: [
    { from: "scheduled", to: "in-progress" },
    { from: "in-progress", to: "passed" },
    { from: "in-progress", to: "failed" },
    { from: "in-progress", to: "needs-rework" },
    { from: "needs-rework", to: "scheduled" },
  ],
  initial: "scheduled",
  terminal: ["passed", "failed"],
});

const areaCleanliness = defineStateMachine({
  id: "area-cleanliness",
  name: "Area Cleanliness",
  states: ["dirty", "scheduled", "cleaning", "clean", "inspected"],
  transitions: [
    { from: "dirty", to: "scheduled" },
    { from: "scheduled", to: "cleaning" },
    { from: "cleaning", to: "clean" },
    { from: "clean", to: "inspected" },
    { from: "inspected", to: "dirty" },
    { from: "clean", to: "dirty" },
  ],
  initial: "dirty",
  terminal: [],
});

const buildingLifecycle = defineStateMachine({
  id: "building-lifecycle",
  name: "Building Lifecycle",
  states: ["active", "maintenance", "inactive"],
  transitions: [
    { from: "active", to: "maintenance" },
    { from: "maintenance", to: "active" },
    { from: "active", to: "inactive" },
    { from: "inactive", to: "active" },
  ],
  initial: "active",
  terminal: [],
});

// ── Measurements ────────────────────────────────────────────────────────────

const measurements = [
  defineMeasurement({ metric: "area", unit: "m²", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "duration", unit: "minutes", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "ph", unit: "pH", valueType: "number", min: 0, max: 14 }),
  defineMeasurement({ metric: "dilution-ratio", unit: "ratio", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "contact-time", unit: "seconds", valueType: "number", min: 0 }),
  defineMeasurement({ metric: "inspection-score", unit: "score", valueType: "number", min: 0, max: 100 }),
];

// ── Constraints ─────────────────────────────────────────────────────────────

const constraints = [
  defineConstraint({ id: "task-must-have-target", kind: "must_have", targetEntityType: "cleaning-task", attributeRef: "taskType", params: {} }),
  defineConstraint({ id: "chemical-must-have-ph", kind: "must_have", targetEntityType: "chemical", attributeRef: "ph", params: {} }),
  defineConstraint({ id: "surface-must-have-material", kind: "must_have", targetEntityType: "surface", attributeRef: "material", params: {} }),
  defineConstraint({ id: "building-must-have-type", kind: "must_have", targetEntityType: "building", attributeRef: "type", params: {} }),
];

// ── The Domain Definition ───────────────────────────────────────────────────

export const cleaningDomain = defineDomain({
  id: "cleaning.domain",
  name: "cleaning",
  version: 1,
  displayName: "Cleaning Domain",
  description: "Universal cleaning domain — buildings, areas, rooms, surfaces, materials, equipment, chemicals, consumables, tasks, inspections.",
  entityTypes: [buildingType, areaType, roomType, surfaceType, materialType, equipmentType, chemicalType, consumableType, cleaningTaskType, inspectionType],
  relationships,
  stateMachines: [taskLifecycle, roomCleanliness, surfaceCleanliness, equipmentLifecycle, inspectionLifecycle, areaCleanliness, buildingLifecycle],
  measurements,
  constraints,
  ownerProtocolId: "cleaning.protocol.residential",
});

export default cleaningDomain;
