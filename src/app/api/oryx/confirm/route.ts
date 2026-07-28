import { NextResponse } from "next/server";
import { startTrip } from "@/lib/oryx-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { origin, destination, offer } = body;

    // Confirm = start the trip through the Coordination Kernel
    const tripId = `trip-${Date.now()}`;
    const trip = startTrip(tripId, origin, destination, {
      id: offer.id || tripId,
      provider: {
        id: "confirmed",
        type: offer.providerType || "platform",
        name: offer.provider || "Driver",
        available: true,
        rating: offer.rating || 4.5,
        etaSeconds: offer.etaSeconds || 300,
        estimatedFare: offer.fare || 10,
        currency: offer.currency || "USD",
        vehicleType: offer.vehicleType || "sedan",
        capacity: 4,
        features: offer.features || [],
        poolingAvailable: offer.poolingAvailable || false,
      },
      fare: offer.fare || 10,
      currency: offer.currency || "USD",
      etaSeconds: offer.etaSeconds || 300,
      distanceMeters: 0,
      durationSeconds: 0,
      route: { points: [] },
      poolingAvailable: offer.poolingAvailable || false,
      score: 1,
      rationale: offer.rationale || "Confirmed by user",
      alternatives: [],
    });

    return NextResponse.json({ ok: true, trip });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
