/**
 * Oryx Experience Definitions — the UI flows driven by the Experience Runtime.
 *
 * Every interaction invokes the underlying marketplace. No component owns
 * business state — the runtime emits experience state, the UI renders it.
 *
 * Built on the frozen Experience Runtime (M19).
 */

// ── Booking Flow ────────────────────────────────────────────────────────────

export const bookingJourneyStages = [
  { id: "search", name: "Search", order: 10, milestones: ["origin-set", "destination-set"] },
  { id: "compile", name: "Compile", order: 20, milestones: ["intent-compiled"] },
  { id: "marketplace", name: "Marketplace", order: 30, milestones: ["providers-evaluated"] },
  { id: "negotiate", name: "Negotiate", order: 40, milestones: ["best-offer-secured"] },
  { id: "recommend", name: "Recommend", order: 50, milestones: ["recommendation-shown"] },
  { id: "confirm", name: "Confirm", order: 60, milestones: ["trip-confirmed"] },
  { id: "execute", name: "Execute", order: 70, milestones: ["driver-assigned", "en-route-pickup"] },
  { id: "track", name: "Track", order: 80, milestones: ["passenger-boarded", "in-trip", "arriving"] },
  { id: "settle", name: "Settle", order: 90, milestones: ["trip-completed", "payment-settled"] },
] as const;

// ── Parcel Flow ─────────────────────────────────────────────────────────────

export const parcelJourneyStages = [
  { id: "pickup", name: "Pickup", order: 10, milestones: ["pickup-location-set"] },
  { id: "destination", name: "Destination", order: 20, milestones: ["delivery-location-set"] },
  { id: "details", name: "Package Details", order: 30, milestones: ["parcel-described"] },
  { id: "marketplace", name: "Marketplace Opens", order: 40, milestones: ["intent-published"] },
  { id: "bids", name: "Live Bids", order: 50, milestones: ["bids-received"] },
  { id: "compare", name: "Compare Bids", order: 60, milestones: ["bids-compared"] },
  { id: "accept", name: "Accept", order: 70, milestones: ["bid-accepted"] },
  { id: "tracking", name: "Tracking", order: 80, milestones: ["picked-up", "in-transit"] },
  { id: "delivery", name: "Delivery", order: 90, milestones: ["delivered"] },
] as const;

// ── Explainability Templates ────────────────────────────────────────────────

export interface ExplainabilityTemplate {
  readonly question: string;
  readonly answerTemplate: string;
  readonly variables: readonly string[];
}

export const explainabilityTemplates: readonly ExplainabilityTemplate[] = [
  {
    question: "Why this provider?",
    answerTemplate: "{{providerName}} was selected because {{reasons}}. It scored {{score}} out of 1.0 across ETA, fare, rating, and features.",
    variables: ["providerName", "reasons", "score"],
  },
  {
    question: "Why this price?",
    answerTemplate: "The fare of {{currency}}{{fare}} was {{priceReason}}. {{discounts}}",
    variables: ["currency", "fare", "priceReason", "discounts"],
  },
  {
    question: "Why not {{alternative}}?",
    answerTemplate: "{{alternative}} was evaluated but {{rejectionReason}}. It scored {{alternativeScore}} vs {{bestScore}} for the selected provider.",
    variables: ["alternative", "rejectionReason", "alternativeScore", "bestScore"],
  },
  {
    question: "Why pooling?",
    answerTemplate: "Pooling is {{poolingReason}}. It saves {{poolingDiscount}}% and adds ~{{poolingDelay}}s to your trip.",
    variables: ["poolingReason", "poolingDiscount", "poolingDelay"],
  },
  {
    question: "Why this ETA?",
    answerTemplate: "ETA is {{etaMinutes}} minutes based on {{etaFactors}}.",
    variables: ["etaMinutes", "etaFactors"],
  },
  {
    question: "Why this route?",
    answerTemplate: "This route is {{routeReason}}. {{alternatives}} alternative route(s) available.",
    variables: ["routeReason", "alternatives"],
  },
];

// ── Tracking States ─────────────────────────────────────────────────────────

export const trackingStates = {
  searching: { label: "Finding your ride...", color: "#f59e0b", icon: "🔍" },
  matched: { label: "Driver found!", color: "#10b981", icon: "✅" },
  enRoute: { label: "Driver en route to pickup", color: "#3b82f6", icon: "🚗" },
  arriving: { label: "Driver arriving", color: "#8b5cf6", icon: "📍" },
  boarded: { label: "Passenger boarded", color: "#10b981", icon: "🧑" },
  inTrip: { label: "On the way to destination", color: "#3b82f6", icon: "🚗" },
  arrivingDest: { label: "Arriving at destination", color: "#8b5cf6", icon: "📍" },
  completed: { label: "Trip completed", color: "#10b981", icon: "✅" },
  cancelled: { label: "Trip cancelled", color: "#ef4444", icon: "❌" },
} as const;

// ── UI Components Registry ──────────────────────────────────────────────────

export const uiExtensions = [
  { mountPoint: "booking.search", componentRef: "oryx.BookingSearch", enabled: true },
  { mountPoint: "booking.results", componentRef: "oryx.BookingResults", enabled: true },
  { mountPoint: "booking.tracking", componentRef: "oryx.LiveTracking", enabled: true },
  { mountPoint: "booking.explainability", componentRef: "oryx.ExplainabilityPanel", enabled: true },
  { mountPoint: "parcel.publish", componentRef: "oryx.ParcelPublish", enabled: true },
  { mountPoint: "parcel.bids", componentRef: "oryx.LiveBids", enabled: true },
  { mountPoint: "parcel.tracking", componentRef: "oryx.ParcelTracking", enabled: true },
  { mountPoint: "map.main", componentRef: "oryx.MobilityMap", enabled: true },
  { mountPoint: "map.bottom-sheet", componentRef: "oryx.BottomSheet", enabled: true },
] as const;
