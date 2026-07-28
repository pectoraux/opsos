import { NextResponse } from "next/server";
import { executeMobilityIntent } from "@/lib/oryx-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { origin, destination } = body;

    // Compute route via the routing provider
    const result = executeMobilityIntent({
      intentType: "transport-passenger",
      origin,
      destination,
    });

    return NextResponse.json({
      ok: true,
      route: result.route,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
