import { NextResponse } from "next/server";
import { executeMobilityIntent } from "@/lib/oryx-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Parcel publish = execute mobility intent with deliver-parcel type
    // The marketplace opens automatically — bids are evaluated by the compiler
    const result = executeMobilityIntent({
      ...body,
      intentType: "deliver-parcel",
    });

    return NextResponse.json({
      ok: true,
      published: true,
      stages: result.stages.map((s) => ({ stage: s.stage, status: s.status, detail: s.detail })),
      bids: result.parcelBidding?.bids.map((b) => ({
        id: b.id,
        provider: b.providerName,
        providerType: b.providerType,
        fare: b.fare,
        currency: b.currency,
        etaSeconds: b.etaSeconds,
        rating: b.rating,
      })) ?? [],
      recommendedBid: result.parcelBidding?.recommendedBid ? {
        provider: result.parcelBidding.recommendedBid.providerName,
        fare: result.parcelBidding.recommendedBid.fare,
        etaSeconds: result.parcelBidding.recommendedBid.etaSeconds,
        rating: result.parcelBidding.recommendedBid.rating,
      } : null,
      explanation: result.recommendation.explanation,
      whyNot: result.recommendation.whyNot,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
