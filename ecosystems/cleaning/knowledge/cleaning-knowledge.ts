/**
 * Cleaning Knowledge — operational knowledge artifacts only.
 *
 * NO executable behavior. NO workflows. NO UI. NO AI.
 * Only knowledge artifacts: SOPs, safety procedures, chemical compatibility,
 * equipment manuals, regulations, certifications, quality standards.
 *
 * All artifacts are registered through the Knowledge Kernel via @kernel/api/v1.
 * The platform owns storage, versioning, provenance, confidence, and applicability.
 */

import type {
  KnowledgeItem,
  Procedure,
  Regulation,
  Standard,
  Guideline,
  Fact,
} from "@kernel/api/v1";
import { asId } from "@kernel/api/v1";

const NOW = 1700000000000; // Fixed timestamp — deterministic

// ── 1. SOPs (Standard Operating Procedures) ────────────────────────────────

export const bathroomDeepCleanSOP: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.sop.bathroom-deep-clean"),
  kind: "procedure",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "Bathroom Deep Clean Procedure",
  description: "Complete deep cleaning procedure for bathrooms including disinfection, descaling, and detail work.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "room",
    subjectId: "bathroom",
    conditions: [{ op: "eq", args: ["room.type", "bathroom"] }],
    tags: ["cleaning", "sop", "bathroom", "deep-clean"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.sop.bathroom"),
    sourceId: asId<"SourceId">("cleaning.source.issc"),
    type: "document",
    description: "ISSA Cleaning Industry Management Standard",
    reference: "issa-cims-2024",
    confidence: 0.95,
  }],
  confidence: 0.92,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.residential",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { estimatedDuration: 45, difficulty: "medium" },
};

export const kitchenDegreasingSOP: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.sop.kitchen-degreasing"),
  kind: "procedure",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "Commercial Kitchen Degreasing Procedure",
  description: "Heavy-duty degreasing for commercial kitchens including hood, filters, and surfaces.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "area",
    subjectId: "kitchen",
    conditions: [{ op: "eq", args: ["area.type", "commercial-kitchen"] }],
    tags: ["cleaning", "sop", "kitchen", "degreasing", "commercial"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.sop.kitchen"),
    sourceId: asId<"SourceId">("cleaning.source.nfpa"),
    type: "citation",
    description: "NFPA 96 Standard for Ventilation Control and Fire Protection",
    reference: "nfpa-96-2024",
    confidence: 0.98,
  }],
  confidence: 0.95,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.commercial",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { estimatedDuration: 120, difficulty: "high", requiresCertification: true },
};

// ── 2. Chemical Compatibility Facts ─────────────────────────────────────────

export const marbleAcidDamageFact: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.fact.marble-acid-damage"),
  kind: "fact",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "Marble is Damaged by Acidic Chemicals",
  description: "Acidic cleaners (pH < 7) etch and permanently damage marble surfaces. Use only pH-neutral cleaners on marble.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "material",
    subjectId: "marble",
    conditions: [{ op: "lt", args: ["chemical.pH", 7] }],
    tags: ["cleaning", "chemical-compatibility", "marble", "acid"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.marble"),
    sourceId: asId<"SourceId">("cleaning.source.marble-institute"),
    type: "citation",
    description: "Marble Institute of America Care & Cleaning Guidelines",
    reference: "mia-care-guide-2024",
    confidence: 0.99,
  }],
  confidence: 0.99,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.residential",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { severity: "critical", irreversible: true },
};

export const bleachAmmoniaMixFact: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.fact.bleach-ammonia-mix"),
  kind: "fact",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "Bleach and Ammonia Produce Toxic Chloramine Gas",
  description: "Mixing sodium hypochlorite (bleach) with ammonia produces chloramine gas, which is toxic and potentially fatal. NEVER mix these chemicals.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "chemical",
    subjectId: "bleach",
    conditions: [{ op: "eq", args: ["chemical.companion", "ammonia"] }],
    tags: ["cleaning", "chemical-safety", "toxic", "bleach", "ammonia"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.bleach"),
    sourceId: asId<"SourceId">("cleaning.source.osha"),
    type: "citation",
    description: "OSHA Chemical Sampling Information: Chloramine",
    reference: "osha-chloramine",
    confidence: 1.0,
  }],
  confidence: 1.0,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.residential",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { severity: "critical", hazard: "toxic-gas", fatalityRisk: true },
};

export const woodWaterDamageFact: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.fact.wood-water-damage"),
  kind: "fact",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "Hardwood Floors Damaged by Excess Water",
  description: "Standing water or excessive moisture causes hardwood floors to warp, cup, and rot. Use minimal moisture and dry immediately.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "material",
    subjectId: "hardwood",
    conditions: [{ op: "gt", args: ["moisture.liquid", "minimal"] }],
    tags: ["cleaning", "material-care", "wood", "water-damage"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.wood"),
    sourceId: asId<"SourceId">("cleaning.source.nwfa"),
    type: "citation",
    description: "National Wood Flooring Association Care Guide",
    reference: "nwfa-care-2024",
    confidence: 0.95,
  }],
  confidence: 0.95,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.residential",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { severity: "high" },
};

// ── 3. Safety Procedures ────────────────────────────────────────────────────

export const chemicalSafetyProcedure: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.safety.chemical-handling"),
  kind: "guideline",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "Chemical Handling Safety Procedure",
  description: "Mandatory safety procedure for handling, mixing, and storing cleaning chemicals. Includes PPE requirements and SDS protocols.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "chemical",
    conditions: [],
    tags: ["cleaning", "safety", "chemical", "ppe", "sds"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.safety"),
    sourceId: asId<"SourceId">("cleaning.source.osha"),
    type: "citation",
    description: "OSHA Hazard Communication Standard 29 CFR 1910.1200",
    reference: "osha-hazcom",
    confidence: 1.0,
  }],
  confidence: 1.0,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.residential",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { mandatory: true, ppeRequired: ["gloves", "goggles", "apron"] },
};

// ── 4. Regulations ──────────────────────────────────────────────────────────

export const disinfectionStandardRegulation: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.reg.disinfection-standard"),
  kind: "regulation",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "EPA Disinfection Standards for Healthcare Facilities",
  description: "Mandatory disinfection protocols for healthcare environments. Requires EPA-registered disinfectants with specific contact times.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "facility",
    subjectId: "healthcare",
    conditions: [{ op: "eq", args: ["facility.type", "healthcare"] }],
    tags: ["cleaning", "regulation", "epa", "disinfection", "healthcare"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.reg"),
    sourceId: asId<"SourceId">("cleaning.source.epa"),
    type: "citation",
    description: "EPA List N: Disinfectants for Emerging Viral Pathogens",
    reference: "epa-list-n",
    confidence: 1.0,
  }],
  confidence: 1.0,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.hospital",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { jurisdiction: "US", severity: "mandatory", penalties: true },
};

// ── 5. Quality Standards ────────────────────────────────────────────────────

export const cleaningQualityStandard: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.standard.issa-cims"),
  kind: "standard",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "ISSA Cleaning Industry Management Standard (CIMS)",
  description: "Industry standard for cleaning quality management. Defines service quality, documentation, and continuous improvement requirements.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "organization",
    conditions: [],
    tags: ["cleaning", "quality", "issa", "cims", "standard"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.issa"),
    sourceId: asId<"SourceId">("cleaning.source.issa"),
    type: "document",
    description: "ISSA CIMS Certification Manual",
    reference: "issa-cims-manual-2024",
    confidence: 0.95,
  }],
  confidence: 0.95,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.commercial",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { category: "quality", certificationRequired: true },
};

// ── 6. Equipment Manuals ────────────────────────────────────────────────────

export const vacuumMaintenanceManual: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.manual.vacuum-maintenance"),
  kind: "procedure",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "Commercial Vacuum Maintenance Manual",
  description: "Maintenance schedule and procedures for commercial vacuum cleaners. Includes filter replacement, belt inspection, and brush roll cleaning.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "equipment",
    subjectId: "vacuum",
    conditions: [],
    tags: ["cleaning", "equipment", "vacuum", "maintenance"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.vacuum"),
    sourceId: asId<"SourceId">("cleaning.source.manufacturer"),
    type: "document",
    description: "ProTeam Vacuum Maintenance Guide",
    reference: "proteam-maintenance-2024",
    confidence: 0.9,
  }],
  confidence: 0.9,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.commercial",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { equipmentType: "vacuum", maintenanceIntervalDays: 30 },
};

// ── 7. Certification Requirements ───────────────────────────────────────────

export const cleaningCertificationStandard: KnowledgeItem = {
  id: asId<"KnowledgeItemId">("cleaning.ki.standard.cleaner-certification"),
  kind: "standard",
  tenantId: asId<"TenantId">("cleaning-tenant"),
  title: "Cleaner Certification Requirements",
  description: "Defines certification levels for cleaning professionals: Level 1 (Basic), Level 2 (Advanced), Level 3 (Specialist). Includes required training and assessment criteria.",
  version: 1,
  status: "active",
  applicability: {
    subjectKind: "resource",
    subjectId: "cleaner",
    conditions: [],
    tags: ["cleaning", "certification", "training", "qualification"],
  },
  evidence: [{
    id: asId<"EvidenceId">("cleaning.ev.cert"),
    sourceId: asId<"SourceId">("cleaning.source.issa"),
    type: "document",
    description: "ISSA Cleaning Industry Training Standard",
    reference: "issa-training-2024",
    confidence: 0.92,
  }],
  confidence: 0.92,
  provenance: { sourceEventIds: [] },
  ownerProtocolId: "cleaning.protocol.residential",
  createdAt: NOW,
  updatedAt: NOW,
  metadata: { levels: 3, recertificationIntervalMonths: 24 },
};

// ── All Knowledge Artifacts ─────────────────────────────────────────────────

export const cleaningKnowledgeArtifacts: readonly KnowledgeItem[] = [
  bathroomDeepCleanSOP,
  kitchenDegreasingSOP,
  marbleAcidDamageFact,
  bleachAmmoniaMixFact,
  woodWaterDamageFact,
  chemicalSafetyProcedure,
  disinfectionStandardRegulation,
  cleaningQualityStandard,
  vacuumMaintenanceManual,
  cleaningCertificationStandard,
];
