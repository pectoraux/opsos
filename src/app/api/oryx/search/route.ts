import { NextResponse } from "next/server";
import { executeMobilityIntent } from "@/lib/oryx-runtime";
import type { MobilityIntent } from "@/lib/oryx-runtime";

export async function POST(request: Request) {
  try {
    const body: MobilityIntent = await request.json();

    // Execute the FULL compiler pipeline — every stage, no shortcuts
    const result = executeMobilityIntent(body);

    return NextResponse.json({
      ok: true,
      stages: result.stages.map((s) => ({ stage: s.stage, status: s.status, detail: s.detail })),
      route: result.route,
      marketplace: result.marketplace ? {
        offers: result.marketplace.offers.map((o) => ({
          id: o.id,
          provider: o.provider.name,
          providerType: o.provider.type,
          fare: o.fare,
          currency: o.currency,
          etaSeconds: o.etaSeconds,
          rating: o.provider.rating,
          vehicleType: o.provider.vehicleType,
          features: o.provider.features,
          poolingAvailable: o.poolingAvailable,
          poolingDiscount: o.poolingDiscount,
          corporateRate: o.corporateRate,
          subscriptionBenefit: o.subscriptionBenefit,
          score: o.score,
          rationale: o.rationale,
        })),
        bestOffer: result.marketplace.bestOffer ? {
          provider: result.marketplace.bestOffer.provider.name,
          providerType: result.marketplace.bestOffer.provider.type,
          fare: result.marketplace.bestOffer.fare,
          etaSeconds: result.marketplace.bestOffer.etaSeconds,
          rating: result.marketplace.bestOffer.provider.rating,
          score: result.marketplace.bestOffer.score,
          rationale: result.marketplace.bestOffer.rationale,
        } : null,
        totalProvidersEvaluated: result.marketplace.totalProvidersEvaluated,
        explanation: result.marketplace.explanation,
      } : null,
      parcelBidding: result.parcelBidding ? {
        bids: result.parcelBidding.bids.map((b) => ({
          id: b.id,
          provider: b.providerName,
          providerType: b.providerType,
          fare: b.fare,
          currency: b.currency,
          etaSeconds: b.etaSeconds,
          rating: b.rating,
        })),
        recommendedBid: result.parcelBidding.recommendedBid ? {
          provider: result.parcelBidding.recommendedBid.providerName,
          fare: result.parcelBidding.recommendedBid.fare,
          etaSeconds: result.parcelBidding.recommendedBid.etaSeconds,
          rating: result.parcelBidding.recommendedBid.rating,
        } : null,
        totalBids: result.parcelBidding.totalBids,
        explanation: result.parcelBidding.explanation,
      } : null,
      recommendation: {
        explanation: result.recommendation.explanation,
        whyNot: result.recommendation.whyNot,
      },
      experience: result.experience,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
