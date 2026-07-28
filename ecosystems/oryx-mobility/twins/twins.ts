/**
 * Oryx Digital Twin Definitions — runtime projections for mobility entities.
 *
 * Every trip produces: trip twin, driver twin, vehicle twin, market twin,
 * network twin. These are runtime projections managed by the frozen Digital
 * Twin Runtime (M18).
 */

export interface TripTwinState {
  readonly tripId: string;
  readonly status: string;
  readonly currentLocation: { lat: number; lng: number };
  readonly progress: number; // 0-1
  readonly remainingDistance: number;
  readonly remainingDuration: number;
  readonly fare: number;
  readonly driverId?: string;
  readonly vehicleId?: string;
}

export interface DriverTwinState {
  readonly driverId: string;
  readonly status: string;
  readonly currentLocation: { lat: number; lng: number };
  readonly rating: number;
  readonly tripsToday: number;
  readonly earningsToday: number;
  readonly acceptanceRate: number;
  readonly onlineDuration: number;
}

export interface VehicleTwinState {
  readonly vehicleId: string;
  readonly status: string;
  readonly currentLocation: { lat: number; lng: number };
  readonly fuelLevel: number; // 0-1
  readonly odometer: number;
  readonly lastInspection: number;
  readonly nextMaintenance: number;
}

export interface MarketTwinState {
  readonly activeProviders: number;
  readonly activeTrips: number;
  readonly averageFare: number;
  readonly averageEta: number;
  readonly surgeMultiplier: number;
  readonly poolingUtilization: number;
  readonly providerBreakdown: {
    readonly platform: number;
    readonly partnerFleet: number;
    readonly thirdParty: number;
    readonly corporate: number;
    readonly autonomous: number;
  };
}

export interface NetworkTwinState {
  readonly totalVehicles: number;
  readonly availableVehicles: number;
  readonly busyVehicles: number;
  readonly offlineVehicles: number;
  readonly averageSpeed: number;
  readonly trafficLevel: "low" | "medium" | "high";
  readonly coverage: { lat: number; lng: number; radius: number }[];
}

// ── Twin Configuration ──────────────────────────────────────────────────────

export const twinConfigs = {
  trip: {
    entityType: "trip",
    metrics: ["progress", "remaining-distance", "remaining-duration", "fare"],
    healthChecks: ["status-valid", "driver-assigned", "vehicle-assigned"],
    predictions: ["completion-time", "final-fare"],
    simulations: ["route-optimization", "traffic-impact"],
  },
  driver: {
    entityType: "driver",
    metrics: ["rating", "trips-today", "earnings-today", "acceptance-rate"],
    healthChecks: ["certification-valid", "background-check-current"],
    predictions: ["earnings-projection", "fatigue-risk"],
    simulations: ["schedule-optimization"],
  },
  vehicle: {
    entityType: "vehicle",
    metrics: ["fuel-level", "odometer", "inspection-status"],
    healthChecks: ["inspection-current", "maintenance-due"],
    predictions: ["maintenance-needed", "fuel-depletion"],
    simulations: ["fleet-rebalancing"],
  },
  market: {
    entityType: "marketplace",
    metrics: ["active-providers", "active-trips", "average-fare", "surge-multiplier"],
    healthChecks: ["liquidity-sufficient", "competition-fair"],
    predictions: ["demand-surge", "supply-shortage"],
    simulations: ["pricing-optimization", "capacity-planning"],
  },
  network: {
    entityType: "network",
    metrics: ["total-vehicles", "available-vehicles", "average-speed", "traffic-level"],
    healthChecks: ["coverage-adequate", "capacity-sufficient"],
    predictions: ["traffic-forecast", "demand-forecast"],
    simulations: ["network-optimization", "expansion-planning"],
  },
} as const;
