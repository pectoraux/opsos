/**
 * Oryx Integration Connectors — external system integrations.
 *
 * Uses the frozen Integration Hub (M17). Payments delegate to PaySwap ONLY
 * (OpsOS never processes payments itself). Routing uses external APIs.
 */

// ── Routing Connector ───────────────────────────────────────────────────────

export interface RoutingRequest {
  readonly origin: { lat: number; lng: number };
  readonly destination: { lat: number; lng: number };
  readonly alternatives?: boolean;
  readonly trafficAware?: boolean;
}

export interface RoutingResponse {
  readonly routes: readonly {
    readonly distance: number;
    readonly duration: number;
    readonly points: readonly { lat: number; lng: number }[];
    readonly trafficLevel: "low" | "medium" | "high";
  }[];
  readonly bestRoute: {
    readonly distance: number;
    readonly duration: number;
    readonly points: readonly { lat: number; lng: number }[];
  };
}

export const routingConnector = {
  id: "oryx.connector.routing",
  kind: "maps" as const,
  name: "Routing Engine",
  provider: "mapbox",
  config: { apiVersion: "1.0" },
  status: "active" as const,
  capabilities: ["read", "query"],
};

// ── Payment Connector (PaySwap ONLY) ────────────────────────────────────────

export const paymentConnector = {
  id: "oryx.connector.payment",
  kind: "payment" as const,
  name: "PaySwap Payment",
  provider: "payswap",
  config: { apiVersion: "1.0" },
  status: "active" as const,
  capabilities: ["charge", "refund", "query"],
};

// OpsOS NEVER processes payments itself — all payments delegate to PaySwap.

// ── Maps Connector ──────────────────────────────────────────────────────────

export const mapsConnector = {
  id: "oryx.connector.maps",
  kind: "maps" as const,
  name: "Map Tiles",
  provider: "mapbox",
  config: { apiVersion: "1.0", style: "streets-v12" },
  status: "active" as const,
  capabilities: ["read"],
};

// ── Geocoding Connector ─────────────────────────────────────────────────────

export const geocodingConnector = {
  id: "oryx.connector.geocoding",
  kind: "maps" as const,
  name: "Geocoding",
  provider: "mapbox",
  config: { apiVersion: "1.0" },
  status: "active" as const,
  capabilities: ["read", "query"],
};

// ── Third-Party Ride-Hailing Connectors ─────────────────────────────────────

export const thirdPartyConnectors = [
  { id: "oryx.connector.uber", kind: "custom" as const, name: "Uber API", provider: "uber", config: {}, status: "active" as const, capabilities: ["read", "query"] },
  { id: "oryx.connector.bolt", kind: "custom" as const, name: "Bolt API", provider: "bolt", config: {}, status: "active" as const, capabilities: ["read", "query"] },
  { id: "oryx.connector.lyft", kind: "custom" as const, name: "Lyft API", provider: "lyft", config: {}, status: "active" as const, capabilities: ["read", "query"] },
];

// ── All Connectors ──────────────────────────────────────────────────────────

export const oryxConnectors = [
  routingConnector,
  paymentConnector,
  mapsConnector,
  geocodingConnector,
  ...thirdPartyConnectors,
];
