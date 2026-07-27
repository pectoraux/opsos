/**
 * @kernel/shared-kernel/domain/primitives/resource — the resource-kernel
 * canonical primitives introduced in M7.
 *
 *   Location · Calendar · Certification · ResourceHealth · Telemetry
 *
 * These realize the universal resource concepts every industry shares.
 * Domain-independent. No industry-specific fields.
 *
 * The Resource Kernel REALIZES the existing `Resource`, `Capability`,
 * `Availability`, `Capacity`, and `Twin` primitives (from M1) with full
 * behavior — state machines, tracking, querying. These new primitives are the
 * additional nouns the resource kernel needs.
 */

import type {
  LocationId,
  CalendarId,
  CalendarEntryId,
  CertificationId,
  TelemetryId,
  MaintenanceId,
  ResourceId,
  CapabilityId,
  TenantId,
} from "../identifiers";
import type {
  Quantity,
  UnknownRecord,
  ProvenanceRef,
} from "../value-objects";
import type { TemporalWindow } from "../temporal";
import type { Twin } from "./twin";

// ── 1. Location ─────────────────────────────────────────────────────────────

/**
 * A universal location abstraction — NOT raw GPS. Supports geometry, regions,
 * zones, hierarchies, and movement. Mobility uses roads; cleaning uses
 * buildings; healthcare uses hospital wings; waste uses routes — all through
 * the same abstraction.
 */
export interface Location {
  readonly id: LocationId;
  readonly kind: "point" | "zone" | "region" | "building" | "floor" | "room" | "route" | "area";
  readonly label: string;
  /** Optional parent location (hierarchy: building → floor → room). */
  readonly parentId?: LocationId;
  /** Geometry — opaque to the kernel; protocols interpret. */
  readonly geometry?: UnknownRecord;
  /** Optional address-like metadata. */
  readonly attributes?: UnknownRecord;
}

/** A movement event — a resource moving from one location to another. */
export interface Movement {
  readonly resourceId: ResourceId;
  readonly fromLocationId?: LocationId;
  readonly toLocationId: LocationId;
  readonly startedAt: number;
  readonly estimatedArrival?: number;
  readonly arrivedAt?: number;
  /** Travel model ref — protocol-defined (walking, driving, flying, etc.). */
  readonly travelModelRef?: string;
}

// ── 2. Calendar ─────────────────────────────────────────────────────────────

export type CalendarEntryType = "booking" | "block" | "availability" | "maintenance" | "travel";

/** A single entry in a resource's calendar. */
export interface CalendarEntry {
  readonly id: CalendarEntryId;
  readonly calendarId: CalendarId;
  readonly type: CalendarEntryType;
  readonly window: TemporalWindow;
  readonly subjectType?: string;
  readonly subjectId?: string;
  readonly status: "tentative" | "confirmed" | "cancelled" | "completed";
}

/** A resource's calendar — bookings, blocks, availability windows. */
export interface Calendar {
  readonly id: CalendarId;
  readonly resourceId: ResourceId;
  readonly tenantId: TenantId;
  readonly entries: readonly CalendarEntry[];
  readonly timezone: string;
}

// ── 3. Certification ────────────────────────────────────────────────────────

export type CertificationStatus = "active" | "expired" | "revoked" | "pending";

/**
 * A certification — proof that a resource (typically a human) is certified for
 * a capability. Has validity, issuer, and confidence.
 */
export interface Certification {
  readonly id: CertificationId;
  readonly resourceId: ResourceId;
  readonly capabilityId: CapabilityId;
  readonly capabilityType: string;
  readonly level: number;
  readonly issuer: string;
  readonly issuedAt: number;
  readonly expiresAt?: number;
  readonly status: CertificationStatus;
  /** Caller-supplied confidence in [0, 1]. */
  readonly confidence: number;
  readonly evidence?: UnknownRecord;
}

// ── 4. ResourceHealth ───────────────────────────────────────────────────────

export type ResourceOperationalState =
  | "idle"
  | "busy"
  | "reserved"
  | "committed"
  | "offline"
  | "maintenance"
  | "unavailable"
  | "degraded";

export type MaintenanceStatus = "none" | "scheduled" | "in-progress" | "overdue";

/** The operational health of a resource. */
export interface ResourceHealth {
  readonly resourceId: ResourceId;
  readonly operationalState: ResourceOperationalState;
  readonly maintenanceStatus: MaintenanceStatus;
  readonly healthScore: number; // 0..1
  readonly reliabilityScore: number; // 0..1
  readonly lastKnownAt: number;
  readonly issues: readonly ResourceIssue[];
}

/** A health issue affecting a resource. */
export interface ResourceIssue {
  readonly id: MaintenanceId;
  readonly severity: "info" | "warn" | "critical";
  readonly category: string;
  readonly message: string;
  readonly detectedAt: number;
  readonly resolvedAt?: number;
}

/** A scheduled maintenance window. */
export interface Maintenance {
  readonly id: MaintenanceId;
  readonly resourceId: ResourceId;
  readonly window: TemporalWindow;
  readonly type: "preventive" | "corrective" | "emergency" | "inspection";
  readonly status: "scheduled" | "in-progress" | "completed" | "cancelled";
  readonly description: string;
}

// ── 5. Telemetry ────────────────────────────────────────────────────────────

/** A single telemetry reading from a resource. */
export interface Telemetry {
  readonly id: TelemetryId;
  readonly resourceId: ResourceId;
  readonly metric: string;
  readonly value: number;
  readonly unit?: string;
  readonly timestamp: number;
  readonly quality: number; // 0..1 — confidence in the reading
  readonly source: string;
}

// ── Realized resource model ─────────────────────────────────────────────────

/**
 * The full realized resource record — the canonical `Resource` primitive
 * enriched with the resource-kernel's universal metadata. The Resource Kernel
 * owns this; the Coordination Kernel queries it ("give me resources capable of
 * X").
 */
export interface ResourceRecord {
  readonly id: ResourceId;
  readonly resourceType: string;
  readonly tenantId: TenantId;
  readonly displayName: string;
  readonly capabilities: readonly CapabilityId[];
  readonly location?: Location;
  readonly calendar?: Calendar;
  readonly certifications: readonly Certification[];
  readonly health: ResourceHealth;
  readonly twin: Twin;
  readonly costModel?: UnknownRecord;
  readonly qualityMetrics?: UnknownRecord;
  readonly attributes: UnknownRecord;
}
