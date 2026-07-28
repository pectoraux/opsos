/**
 * Oryx Mobility Runtime — the server-side runtime that executes the full
 * compiler pipeline for every mobility request.
 *
 * This is NOT the frozen OpsOS kernel. This is the Oryx ecosystem's runtime
 * that uses the frozen kernel's APIs to execute mobility intents.
 *
 * Every user action dispatches a Mobility Intent through this runtime.
 * The UI is a pure projection — it sends intents, receives results, renders them.
 * No business logic in the UI. No hardcoded pricing, ETAs, or providers.
 */

import { aggregateOffers, evaluateParcelBids } from "../../ecosystems/oryx-mobility/marketplace/marketplace";
import type {
  MobilityProvider,
  MarketplaceOffer,
  AggregationRequest,
  AggregationResult,
  ParcelBid,
  ParcelBiddingResult,
} from "../../ecosystems/oryx-mobility/marketplace/marketplace";

// ── Simulated Providers (would come from the marketplace in production) ─────

const PROVIDERS: readonly MobilityProvider[] = [
  {
    id: "platform-1",
    type: "platform",
    name: "Oryx Driver",
    available: true,
    rating: 4.8,
    etaSeconds: 180,
    estimatedFare: 12.50,
    currency: "USD",
    vehicleType: "sedan",
    capacity: 4,
    features: ["ac", "phone-charger", "music"],
    poolingAvailable: true,
  },
  {
    id: "partner-1",
    type: "partner-fleet",
    name: "City Fleet",
    available: true,
    rating: 4.5,
    etaSeconds: 240,
    estimatedFare: 10.00,
    currency: "USD",
    vehicleType: "sedan",
    capacity: 4,
    features: ["ac"],
    poolingAvailable: true,
  },
  {
    id: "third-party-1",
    type: "third-party",
    name: "Uber",
    available: true,
    rating: 4.6,
    etaSeconds: 210,
    estimatedFare: 14.00,
    currency: "USD",
    vehicleType: "sedan",
    capacity: 4,
    features: ["ac", "phone-charger"],
    poolingAvailable: false,
  },
  {
    id: "third-party-2",
    type: "third-party",
    name: "Bolt",
    available: true,
    rating: 4.3,
    etaSeconds: 300,
    estimatedFare: 9.50,
    currency: "USD",
    vehicleType: "hatchback",
    capacity: 4,
    features: ["ac"],
    poolingAvailable: false,
  },
  {
    id: "corporate-1",
    type: "corporate",
    name: "Corporate Fleet",
    available: true,
    rating: 4.9,
    etaSeconds: 360,
    estimatedFare: 18.00,
    currency: "USD",
    vehicleType: "suv",
    capacity: 6,
    features: ["ac", "phone-charger", "wifi", "leather"],
    poolingAvailable: false,
  },
  {
    id: "autonomous-1",
    type: "autonomous",
    name: "AutoPod",
    available: false,
    rating: 5.0,
    etaSeconds: 120,
    estimatedFare: 8.00,
    currency: "USD",
    vehicleType: "pod",
    capacity: 2,
    features: ["ac", "wifi", "autonomous"],
    poolingAvailable: true,
  },
];

// ── Simulated Parcel Bidders ────────────────────────────────────────────────

const PARCEL_BIDDERS: readonly ParcelBid[] = [
  { id: "bid-1", providerId: "courier-1", providerType: "platform", providerName: "Oryx Courier", fare: 5.50, currency: "USD", etaSeconds: 900, rating: 4.7, bidAt: 0, expiresAt: 60000 },
  { id: "bid-2", providerId: "fleet-1", providerType: "partner-fleet", providerName: "City Fleet Delivery", fare: 4.00, currency: "USD", etaSeconds: 1200, rating: 4.4, bidAt: 0, expiresAt: 60000 },
  { id: "bid-3", providerId: "independent-1", providerType: "third-party", providerName: "Independent Driver", fare: 3.50, currency: "USD", etaSeconds: 1800, rating: 4.1, bidAt: 0, expiresAt: 60000 },
  { id: "bid-4", providerId: "fleet-2", providerType: "partner-fleet", providerName: "Express Fleet", fare: 6.00, currency: "USD", etaSeconds: 600, rating: 4.8, bidAt: 0, expiresAt: 60000 },
];

// ── Routing Provider Interface ──────────────────────────────────────────────

export interface RoutingProvider {
  readonly name: string;
  computeRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): RoutingResult;
}

export interface RoutingResult {
  readonly distance: number; // meters
  readonly duration: number; // seconds
  readonly points: readonly { lat: number; lng: number }[];
  readonly trafficLevel: "low" | "medium" | "high";
  readonly alternatives: readonly {
    readonly distance: number;
    readonly duration: number;
    readonly points: readonly { lat: number; lng: number }[];
    readonly trafficLevel: "low" | "medium" | "high";
  }[];
}

/**
 * Simulated routing provider — generates deterministic routes.
 * In production, this would be Mapbox, Google Maps, OSRM, HERE, or TomTom.
 * All implement the same RoutingProvider interface — swappable.
 */
class SimulatedRoutingProvider implements RoutingProvider {
  readonly name = "Simulated Router";

  computeRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): RoutingResult {
    // Haversine distance approximation
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLng = (destination.lng - origin.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const distance = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

    // Generate route points (straight line with slight curve for visual interest)
    const points: { lat: number; lng: number }[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const curve = Math.sin(t * Math.PI) * 0.001; // slight curve
      points.push({
        lat: origin.lat + (destination.lat - origin.lat) * t + curve,
        lng: origin.lng + (destination.lng - origin.lng) * t,
      });
    }

    // Estimate duration (average 30 km/h urban speed + traffic factor)
    const baseDuration = Math.round(distance / (30 * 1000 / 3600));
    const trafficFactor = distance > 5000 ? 1.3 : 1.1;
    const duration = Math.round(baseDuration * trafficFactor);
    const trafficLevel = distance > 10000 ? "high" : distance > 5000 ? "medium" : "low";

    // Alternative route (longer but potentially faster)
    const altDistance = Math.round(distance * 1.15);
    const altDuration = Math.round(altDistance / (40 * 1000 / 3600));
    const altPoints = points.map((p, i) => ({
      lat: p.lat + (i % 2 === 0 ? 0.002 : -0.001),
      lng: p.lng + 0.003,
    }));

    return {
      distance,
      duration,
      points,
      trafficLevel,
      alternatives: [{
        distance: altDistance,
        duration: altDuration,
        points: altPoints,
        trafficLevel: "low" as const,
      }],
    };
  }
}

const routingProvider: RoutingProvider = new SimulatedRoutingProvider();

// ── Compiler Pipeline Execution ─────────────────────────────────────────────

export interface MobilityIntent {
  readonly intentType: "transport-passenger" | "deliver-parcel" | "reserve-vehicle";
  readonly origin: { lat: number; lng: number };
  readonly destination: { lat: number; lng: number };
  readonly budget?: number;
  readonly currency?: string;
  readonly preferences?: {
    readonly pooling?: boolean;
    readonly corporateRate?: boolean;
    readonly subscriptionId?: string;
    readonly maxEtaSeconds?: number;
    readonly vehicleType?: string;
  };
  readonly parcel?: {
    readonly description: string;
    readonly weight: number;
    readonly fragile: boolean;
  };
}

export interface CompilerStageResult {
  readonly stage: string;
  readonly status: "completed" | "skipped" | "failed";
  readonly detail: string;
  readonly artifacts?: Readonly<Record<string, unknown>>;
}

export interface MobilityExecutionResult {
  readonly intent: MobilityIntent;
  readonly stages: readonly CompilerStageResult[];
  readonly route: RoutingResult;
  readonly marketplace: AggregationResult | null;
  readonly parcelBidding: ParcelBiddingResult | null;
  readonly recommendation: {
    readonly bestOffer: MarketplaceOffer | ParcelBid | null;
    readonly explanation: string;
    readonly whyNot: readonly { readonly provider: string; readonly reason: string }[];
  };
  readonly experience: {
    readonly journeyStage: string;
    readonly nextActions: readonly string[];
    readonly trackingState: string;
  };
}

/**
 * Execute the full Mobility Compiler pipeline.
 *
 * Mobility Intent → Compiler → Capability Resolution → Provider Discovery →
 * Marketplace → Negotiation → Liquidity Evaluation → Recommendation →
 * Explanation → Execution Plan → Experience Runtime
 *
 * The UI NEVER skips stages. Every request executes the full pipeline.
 */
export function executeMobilityIntent(intent: MobilityIntent): MobilityExecutionResult {
  const stages: CompilerStageResult[] = [];

  // Stage 1: Intent Compilation
  stages.push({
    stage: "intent-compilation",
    status: "completed",
    detail: `Compiled ${intent.intentType} intent from ${JSON.stringify(intent.origin)} to ${JSON.stringify(intent.destination)}`,
  });

  // Stage 2: Capability Resolution
  const requiredCapability = intent.intentType === "deliver-parcel" ? "mobility.deliver" : "mobility.drive";
  stages.push({
    stage: "capability-resolution",
    status: "completed",
    detail: `Required capability: ${requiredCapability}`,
    artifacts: { capability: requiredCapability },
  });

  // Stage 3: Route Computation (Routing Provider)
  const route = routingProvider.computeRoute(intent.origin, intent.destination);
  stages.push({
    stage: "route-computation",
    status: "completed",
    detail: `Route computed: ${route.distance}m, ${route.duration}s, traffic: ${route.trafficLevel}. ${route.alternatives.length} alternative(s) available.`,
    artifacts: { distance: route.distance, duration: route.duration, traffic: route.trafficLevel },
  });

  // Stage 4: Provider Discovery
  const availableProviders = PROVIDERS.filter((p) => p.available);
  stages.push({
    stage: "provider-discovery",
    status: "completed",
    detail: `Discovered ${availableProviders.length} available providers: ${availableProviders.map((p) => `${p.name} (${p.type})`).join(", ")}`,
    artifacts: { providerCount: availableProviders.length, providerTypes: [...new Set(availableProviders.map((p) => p.type))] },
  });

  // Stage 5: Marketplace Evaluation
  let marketplace: AggregationResult | null = null;
  let parcelBidding: ParcelBiddingResult | null = null;

  if (intent.intentType === "deliver-parcel") {
    // Parcel flow: evaluate bids
    parcelBidding = evaluateParcelBids(PARCEL_BIDDERS);
    stages.push({
      stage: "marketplace-evaluation",
      status: "completed",
      detail: `Parcel marketplace: ${parcelBidding.totalBids} bids evaluated. Recommended: ${parcelBidding.recommendedBid?.providerName ?? "none"}`,
      artifacts: { bidCount: parcelBidding.totalBids },
    });
  } else {
    // Ride flow: aggregate offers
    const aggRequest: AggregationRequest = {
      origin: intent.origin,
      destination: intent.destination,
      intentType: intent.intentType === "reserve-vehicle" ? "rental" : "ride",
      budget: intent.budget,
      currency: intent.currency,
      preferences: intent.preferences,
    };
    marketplace = aggregateOffers(aggRequest, PROVIDERS);
    stages.push({
      stage: "marketplace-evaluation",
      status: "completed",
      detail: `Ride marketplace: ${marketplace.totalProvidersEvaluated} providers evaluated. Best: ${marketplace.bestOffer.provider.name} (score: ${marketplace.bestOffer.score.toFixed(3)})`,
      artifacts: { providersEvaluated: marketplace.totalProvidersEvaluated, bestScore: marketplace.bestOffer.score },
    });
  }

  // Stage 6: Negotiation (automatic)
  const negotiationResult = {
    negotiated: true,
    discounts: [] as string[],
    finalFare: marketplace?.bestOffer.fare ?? parcelBidding?.recommendedBid?.fare ?? 0,
  };

  if (marketplace && intent.preferences?.pooling && marketplace.bestOffer.poolingAvailable) {
    negotiationResult.discounts.push("Pooling discount: 15%");
    negotiationResult.finalFare = negotiationResult.finalFare * 0.85;
  }
  if (intent.preferences?.corporateRate) {
    negotiationResult.discounts.push("Corporate rate: 10%");
    negotiationResult.finalFare = negotiationResult.finalFare * 0.90;
  }
  if (intent.preferences?.subscriptionId) {
    negotiationResult.discounts.push("Subscription benefit: 5%");
    negotiationResult.finalFare = negotiationResult.finalFare * 0.95;
  }

  stages.push({
    stage: "automatic-negotiation",
    status: negotiationResult.negotiated ? "completed" : "skipped",
    detail: negotiationResult.negotiated
      ? `Negotiated. Final fare: $${negotiationResult.finalFare.toFixed(2)}. Discounts: ${negotiationResult.discounts.join(", ") || "none"}`
      : "No negotiation needed",
    artifacts: { finalFare: negotiationResult.finalFare, discounts: negotiationResult.discounts },
  });

  // Stage 7: Recommendation + Explanation
  const bestOffer = marketplace?.bestOffer ?? null;
  const bestBid = parcelBidding?.recommendedBid ?? null;

  let explanation = "";
  const whyNot: { provider: string; reason: string }[] = [];

  if (bestOffer) {
    const reasons: string[] = [];
    if (bestOffer.etaSeconds < 240) reasons.push(`fastest pickup (${bestOffer.etaSeconds}s)`);
    if (bestOffer.fare <= (intent.budget ?? Infinity)) reasons.push(`within budget ($${bestOffer.fare.toFixed(2)})`);
    if (bestOffer.provider.rating >= 4.5) reasons.push(`highly rated (${bestOffer.provider.rating}★)`);
    if (bestOffer.poolingAvailable) reasons.push("pooling available");
    explanation = `${bestOffer.provider.name} selected for: ${reasons.join(", ")}. Score: ${bestOffer.score.toFixed(3)}/1.0`;

    // Why not alternatives?
    marketplace!.offers.slice(1, 4).forEach((offer) => {
      const reasons: string[] = [];
      if (offer.etaSeconds > bestOffer.etaSeconds) reasons.push(`slower (+${offer.etaSeconds - bestOffer.etaSeconds}s)`);
      if (offer.fare > bestOffer.fare) reasons.push(`more expensive (+$${(offer.fare - bestOffer.fare).toFixed(2)})`);
      if (offer.provider.rating < bestOffer.provider.rating) reasons.push(`lower rating (${offer.provider.rating}★)`);
      whyNot.push({ provider: offer.provider.name, reason: reasons.join(", ") || "similar but lower overall score" });
    });
  } else if (bestBid) {
    explanation = `${bestBid.providerName} selected: best balance of price ($${bestBid.fare}), speed (${bestBid.etaSeconds}s), and rating (${bestBid.rating}★)`;
    parcelBidding!.bids.slice(1, 4).forEach((bid) => {
      const reasons: string[] = [];
      if (bid.fare > bestBid.fare) reasons.push(`more expensive (+$${(bid.fare - bestBid.fare).toFixed(2)})`);
      if (bid.etaSeconds > bestBid.etaSeconds) reasons.push(`slower (+${bid.etaSeconds - bestBid.etaSeconds}s)`);
      if (bid.rating < bestBid.rating) reasons.push(`lower rating (${bid.rating}★)`);
      whyNot.push({ provider: bid.providerName, reason: reasons.join(", ") || "lower overall score" });
    });
  }

  stages.push({
    stage: "recommendation-and-explanation",
    status: "completed",
    detail: explanation,
    artifacts: { explanation, whyNot, finalFare: negotiationResult.finalFare },
  });

  // Stage 8: Experience Runtime
  const journeyStage = intent.intentType === "deliver-parcel" ? "bidding" : "recommend";
  const nextActions = intent.intentType === "deliver-parcel"
    ? ["Compare bids", "Accept best bid", "Track delivery"]
    : ["Review recommendation", "Confirm booking", "Track trip"];
  const trackingState = intent.intentType === "deliver-parcel" ? "searching" : "matched";

  stages.push({
    stage: "experience-runtime",
    status: "completed",
    detail: `Journey stage: ${journeyStage}. Tracking state: ${trackingState}. Next actions: ${nextActions.join(", ")}`,
    artifacts: { journeyStage, nextActions, trackingState },
  });

  return {
    intent,
    stages,
    route,
    marketplace,
    parcelBidding,
    recommendation: {
      bestOffer: bestOffer ?? bestBid,
      explanation,
      whyNot,
    },
    experience: {
      journeyStage,
      nextActions,
      trackingState,
    },
  };
}

// ── Trip Tracking ───────────────────────────────────────────────────────────

export interface TripTrackingState {
  readonly tripId: string;
  readonly status: "searching" | "matched" | "en-route-pickup" | "in-trip" | "arriving" | "completed" | "cancelled";
  readonly driverLocation: { lat: number; lng: number };
  readonly passengerLocation: { lat: number; lng: number };
  readonly destination: { lat: number; lng: number };
  readonly route: readonly { lat: number; lng: number }[];
  readonly eta: number;
  readonly fare: number;
  readonly driverName: string;
  readonly driverRating: number;
  readonly vehicleModel: string;
  readonly vehiclePlate: string;
  readonly progress: number; // 0-1
}

// Simulated trip tracking — in production this would come from the Coordination Kernel + Resource Kernel
const activeTrips = new Map<string, TripTrackingState>();

export function startTrip(tripId: string, origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, offer: MarketplaceOffer): TripTrackingState {
  const route = routingProvider.computeRoute(origin, destination);
  const state: TripTrackingState = {
    tripId,
    status: "en-route-pickup",
    driverLocation: { lat: origin.lat + 0.01, lng: origin.lng + 0.01 },
    passengerLocation: origin,
    destination,
    route: route.points,
    eta: offer.etaSeconds,
    fare: offer.fare,
    driverName: offer.provider.name,
    driverRating: offer.provider.rating,
    vehicleModel: offer.provider.vehicleType,
    vehiclePlate: "ORY-" + Math.floor(Math.random() * 9999).toString().padStart(4, "0"),
    progress: 0,
  };
  activeTrips.set(tripId, state);
  return state;
}

export function getTripTracking(tripId: string): TripTrackingState | undefined {
  return activeTrips.get(tripId);
}

export function updateTripProgress(tripId: string, progress: number): TripTrackingState | undefined {
  const trip = activeTrips.get(tripId);
  if (!trip) return undefined;
  const updated: TripTrackingState = {
    ...trip,
    progress,
    status: progress >= 1 ? "completed" : progress > 0.5 ? "in-trip" : "en-route-pickup",
    eta: Math.round(trip.eta * (1 - progress)),
    driverLocation: {
      lat: trip.driverLocation.lat + (trip.destination.lat - trip.driverLocation.lat) * progress * 0.1,
      lng: trip.driverLocation.lng + (trip.destination.lng - trip.driverLocation.lng) * progress * 0.1,
    },
  };
  activeTrips.set(tripId, updated);
  return updated;
}
