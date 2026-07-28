/**
 * Oryx Marketplace — the mobility exchange.
 *
 * Every participant (platform drivers, partner fleets, third-party ride-hailing,
 * taxi operators, corporate fleets, future autonomous fleets) competes inside
 * one exchange. The customer never books a provider — they purchase the best
 * mobility outcome.
 *
 * Built on the frozen Coordination Kernel (ADR-0015: marketplace is one strategy).
 */

// ── Provider Types ──────────────────────────────────────────────────────────

export type ProviderType =
  | "platform"
  | "partner-fleet"
  | "third-party"
  | "corporate"
  | "autonomous";

export interface MobilityProvider {
  readonly id: string;
  readonly type: ProviderType;
  readonly name: string;
  readonly available: boolean;
  readonly rating: number;
  readonly etaSeconds: number;
  readonly estimatedFare: number;
  readonly currency: string;
  readonly vehicleType: string;
  readonly capacity: number;
  readonly features: readonly string[];
  readonly poolingAvailable: boolean;
}

// ── Marketplace Offer ───────────────────────────────────────────────────────

export interface MarketplaceOffer {
  readonly id: string;
  readonly provider: MobilityProvider;
  readonly fare: number;
  readonly currency: string;
  readonly etaSeconds: number;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly route: { readonly points: readonly { lat: number; lng: number }[] };
  readonly poolingAvailable: boolean;
  readonly poolingDiscount?: number;
  readonly corporateRate?: boolean;
  readonly subscriptionBenefit?: boolean;
  readonly score: number;
  readonly rationale: string;
  readonly alternatives: readonly { readonly provider: string; readonly reason: string }[];
}

// ── Aggregation Engine ──────────────────────────────────────────────────────

export interface AggregationRequest {
  readonly origin: { lat: number; lng: number };
  readonly destination: { lat: number; lng: number };
  readonly intentType: "ride" | "parcel" | "rental" | "corporate";
  readonly budget?: number;
  readonly currency?: string;
  readonly preferences?: {
    readonly pooling?: boolean;
    readonly corporateRate?: boolean;
    readonly subscriptionId?: string;
    readonly maxEtaSeconds?: number;
    readonly vehicleType?: string;
  };
}

export interface AggregationResult {
  readonly offers: readonly MarketplaceOffer[];
  readonly bestOffer: MarketplaceOffer;
  readonly explanation: string;
  readonly totalProvidersEvaluated: number;
}

/**
 * The aggregation engine — evaluates ALL providers and returns ONE ranked list.
 * The customer never sees separate providers; they see the best mobility outcome.
 *
 * Scoring factors (weighted):
 * - ETA (30%): faster is better
 * - Fare (25%): cheaper is better (within budget)
 * - Rating (20%): higher is better
 * - Features (10%): more features = higher score
 * - Pooling discount (10%): if available and preferred
 * - Corporate/subscription benefits (5%): if applicable
 */
export function aggregateOffers(
  request: AggregationRequest,
  providers: readonly MobilityProvider[]
): AggregationResult {
  const availableProviders = providers.filter((p) => p.available);

  const offers: MarketplaceOffer[] = availableProviders.map((provider) => {
    const fare = provider.estimatedFare;
    const eta = provider.etaSeconds;
    const rating = provider.rating;

    // Scoring (0-1 per factor, weighted sum)
    const etaScore = Math.max(0, 1 - eta / 1800); // 30 min = 0
    const fareScore = request.budget
      ? Math.max(0, 1 - fare / request.budget)
      : Math.max(0, 1 - fare / 100);
    const ratingScore = rating / 5;
    const featuresScore = Math.min(1, provider.features.length / 5);
    const poolingScore = provider.poolingAvailable && request.preferences?.pooling ? 0.1 : 0;
    const benefitsScore =
      (request.preferences?.corporateRate && provider.type === "corporate" ? 0.03 : 0) +
      (request.preferences?.subscriptionId ? 0.02 : 0);

    const score =
      etaScore * 0.3 +
      fareScore * 0.25 +
      ratingScore * 0.2 +
      featuresScore * 0.1 +
      poolingScore +
      benefitsScore;

    // Build explanation
    const reasons: string[] = [];
    if (eta < 300) reasons.push("Fastest pickup available");
    if (fare < (request.budget ?? Infinity)) reasons.push("Within your budget");
    if (rating >= 4.5) reasons.push("Highly rated provider");
    if (provider.poolingAvailable) reasons.push("Pooling available for additional savings");
    if (provider.type === "corporate" && request.preferences?.corporateRate)
      reasons.push("Corporate rate applied");
    if (provider.type === "autonomous") reasons.push("Autonomous vehicle — future-ready");

    // Build alternatives
    const alternatives = availableProviders
      .filter((p) => p.id !== provider.id)
      .slice(0, 3)
      .map((p) => ({
        provider: p.name,
        reason: p.etaSeconds < eta ? "Faster but more expensive" : "Cheaper but slower",
      }));

    return {
      id: `offer-${provider.id}`,
      provider,
      fare,
      currency: provider.currency ?? request.currency ?? "USD",
      etaSeconds: eta,
      distanceMeters: 0, // Would come from routing engine
      durationSeconds: 0, // Would come from routing engine
      route: { points: [] }, // Would come from routing engine
      poolingAvailable: provider.poolingAvailable,
      poolingDiscount: provider.poolingAvailable && request.preferences?.pooling ? 0.15 : undefined,
      corporateRate: provider.type === "corporate" && request.preferences?.corporateRate,
      subscriptionBenefit: !!request.preferences?.subscriptionId,
      score,
      rationale: reasons.join(", ") || "Available provider",
      alternatives,
    };
  });

  // Sort by score descending — the best mobility outcome first
  offers.sort((a, b) => b.score - a.score);

  const bestOffer = offers[0]!;

  const explanation = [
    `Evaluated ${availableProviders.length} provider(s):`,
    ...availableProviders.map(
      (p) => `  • ${p.name} (${p.type}): ETA ${p.etaSeconds}s, $${p.estimatedFare}, ★${p.rating}`
    ),
    ``,
    `Best: ${bestOffer.provider.name} — ${bestOffer.rationale}`,
  ].join("\n");

  return {
    offers,
    bestOffer,
    explanation,
    totalProvidersEvaluated: availableProviders.length,
  };
}

// ── Parcel Bidding ──────────────────────────────────────────────────────────

export interface ParcelBid {
  readonly id: string;
  readonly providerId: string;
  readonly providerType: ProviderType;
  readonly providerName: string;
  readonly fare: number;
  readonly currency: string;
  readonly etaSeconds: number;
  readonly rating: number;
  readonly bidAt: number;
  readonly expiresAt: number;
}

export interface ParcelBiddingResult {
  readonly bids: readonly ParcelBid[];
  readonly recommendedBid: ParcelBid | undefined;
  readonly explanation: string;
  readonly totalBids: number;
}

/**
 * The parcel marketplace — the customer publishes a delivery intent, not a
 * courier request. Couriers, fleet providers, and independent drivers bid.
 * The exchange determines the best execution plan.
 */
export function evaluateParcelBids(bids: readonly ParcelBid[]): ParcelBiddingResult {
  if (bids.length === 0) {
    return {
      bids: [],
      recommendedBid: undefined,
      explanation: "No bids received yet. The marketplace is open.",
      totalBids: 0,
    };
  }

  // Score: 40% fare, 30% ETA, 30% rating
  const scored = bids.map((bid) => ({
    bid,
    score:
      (1 - bid.fare / Math.max(...bids.map((b) => b.fare))) * 0.4 +
      (1 - bid.etaSeconds / Math.max(...bids.map((b) => b.etaSeconds))) * 0.3 +
      (bid.rating / 5) * 0.3,
  }));

  scored.sort((a, b) => b.score - a.score);

  const recommended = scored[0]!.bid;
  const explanation = [
    `${bids.length} bid(s) received from:`,
    ...bids.map((b) => `  • ${b.providerName} (${b.providerType}): $${b.fare}, ETA ${b.etaSeconds}s, ★${b.rating}`),
    ``,
    `Recommended: ${recommended.providerName} — best balance of price, speed, and rating.`,
  ].join("\n");

  return {
    bids: scored.map((s) => s.bid),
    recommendedBid: recommended,
    explanation,
    totalBids: bids.length,
  };
}
