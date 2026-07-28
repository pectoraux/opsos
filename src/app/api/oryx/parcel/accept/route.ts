import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bidId, providerName, fare } = body;

    // Accept bid = transition to execution
    // In production this would invoke the Coordination Kernel's assignment engine
    return NextResponse.json({
      ok: true,
      accepted: true,
      bidId,
      provider: providerName,
      fare,
      status: "awarded",
      nextStage: "pickup",
      message: `Bid accepted from ${providerName}. Preparing pickup.`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
