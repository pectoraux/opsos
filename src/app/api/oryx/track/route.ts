import { NextResponse } from "next/server";
import { getTripTracking, updateTripProgress } from "@/lib/oryx-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tripId, action } = body;

    if (action === "status") {
      const trip = getTripTracking(tripId);
      if (!trip) {
        return NextResponse.json({ ok: false, error: "Trip not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, trip });
    }

    if (action === "advance") {
      // Simulate trip progress
      const trip = getTripTracking(tripId);
      if (!trip) {
        return NextResponse.json({ ok: false, error: "Trip not found" }, { status: 404 });
      }
      const newProgress = Math.min(1, trip.progress + 0.15);
      const updated = updateTripProgress(tripId, newProgress);
      return NextResponse.json({ ok: true, trip: updated });
    }

    if (action === "cancel") {
      return NextResponse.json({ ok: true, tripId, status: "cancelled" });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
