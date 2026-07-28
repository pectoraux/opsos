"use client";

import * as React from "react";

/**
 * Oryx Mobility — Consumer UI
 *
 * This is a PURE PROJECTION of the Mobility Runtime.
 * - No hardcoded pricing, ETAs, or providers
 * - Every user action dispatches a Mobility Intent via API
 * - The map is persistent (never unmounts)
 * - The bottom sheet renders Experience Runtime state
 * - Every recommendation includes explainability from compiler artifacts
 * - No button bypasses the marketplace
 */

type JourneyStage = "search" | "results" | "recommend" | "confirm" | "tracking" | "completed" | "parcel-publish" | "parcel-bids" | "parcel-accepted";

interface Offer {
  id: string;
  provider: string;
  providerType: string;
  fare: number;
  currency: string;
  etaSeconds: number;
  rating: number;
  vehicleType: string;
  features: string[];
  poolingAvailable: boolean;
  poolingDiscount?: number;
  corporateRate?: boolean;
  subscriptionBenefit?: boolean;
  score: number;
  rationale: string;
}

interface Bid {
  id: string;
  provider: string;
  providerType: string;
  fare: number;
  currency: string;
  etaSeconds: number;
  rating: number;
}

interface RouteInfo {
  distance: number;
  duration: number;
  points: { lat: number; lng: number }[];
  trafficLevel: string;
  alternatives: { distance: number; duration: number; points: { lat: number; lng: number }[]; trafficLevel: string }[];
}

interface StageResult {
  stage: string;
  status: string;
  detail: string;
}

interface SearchResult {
  ok: boolean;
  stages: StageResult[];
  route: RouteInfo;
  marketplace: {
    offers: Offer[];
    bestOffer: Offer | null;
    totalProvidersEvaluated: number;
    explanation: string;
  } | null;
  parcelBidding: {
    bids: Bid[];
    recommendedBid: Bid | null;
    totalBids: number;
    explanation: string;
  } | null;
  recommendation: {
    explanation: string;
    whyNot: { provider: string; reason: string }[];
  };
  experience: {
    journeyStage: string;
    nextActions: string[];
    trackingState: string;
  };
}

interface TripInfo {
  tripId: string;
  status: string;
  driverLocation: { lat: number; lng: number };
  passengerLocation: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  route: { lat: number; lng: number }[];
  eta: number;
  fare: number;
  driverName: string;
  driverRating: number;
  vehicleModel: string;
  vehiclePlate: string;
  progress: number;
}

export default function OryxPage() {
  // ── Experience Runtime State (the UI only renders this — never owns business logic) ──
  const [stage, setStage] = React.useState<JourneyStage>("search");
  const [origin, setOrigin] = React.useState<{ lat: number; lng: number }>({ lat: 5.6037, lng: -0.1870 }); // Accra
  const [destination, setDestination] = React.useState<{ lat: number; lng: number }>({ lat: 5.6450, lng: -0.1480 });
  const [budget, setBudget] = React.useState<number>(20);
  const [pooling, setPooling] = React.useState(false);
  const [corporateRate, setCorporateRate] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SearchResult | null>(null);
  const [trip, setTrip] = React.useState<TripInfo | null>(null);
  const [selectedOffer, setSelectedOffer] = React.useState<Offer | null>(null);
  const [selectedBid, setSelectedBid] = React.useState<Bid | null>(null);
  const [compilerTrace, setCompilerTrace] = React.useState<StageResult[]>([]);

  // ── Dispatch Mobility Intent (the ONLY way to interact with the runtime) ──
  async function searchRide() {
    setLoading(true);
    setError(null);
    setStage("search");
    try {
      const res = await fetch("/api/oryx/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentType: "transport-passenger",
          origin,
          destination,
          budget,
          currency: "USD",
          preferences: { pooling, corporateRate },
        }),
      });
      const data: SearchResult = await res.json();
      if (!data.ok) throw new Error(data.recommendation?.explanation || "Search failed");
      setResult(data);
      setCompilerTrace(data.stages);
      setStage("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to search");
    } finally {
      setLoading(false);
    }
  }

  // ── Publish Parcel Intent (opens the marketplace for bidding) ──
  async function publishParcel() {
    setLoading(true);
    setError(null);
    setStage("parcel-publish");
    try {
      const res = await fetch("/api/oryx/parcel/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          parcel: { description: "Package", weight: 2, fragile: false },
        }),
      });
      const data: SearchResult = await res.json();
      if (!data.ok) throw new Error("Parcel publish failed");
      setResult(data);
      setCompilerTrace(data.stages);
      setStage("parcel-bids");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish parcel");
    } finally {
      setLoading(false);
    }
  }

  // ── Confirm Ride (dispatches execution intent) ──
  async function confirmRide(offer: Offer) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oryx/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, offer }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error("Confirmation failed");
      setTrip(data.trip);
      setStage("tracking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setLoading(false);
    }
  }

  // ── Accept Parcel Bid ──
  async function acceptBid(bid: Bid) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oryx/parcel/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId: bid.id, providerName: bid.provider, fare: bid.fare }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error("Accept failed");
      setSelectedBid(bid);
      setStage("parcel-accepted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept bid");
    } finally {
      setLoading(false);
    }
  }

  // ── Advance Trip (simulated tracking update) ──
  async function advanceTrip() {
    if (!trip) return;
    try {
      const res = await fetch("/api/oryx/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.tripId, action: "advance" }),
      });
      const data = await res.json();
      if (data.ok && data.trip) {
        setTrip(data.trip);
        if (data.trip.progress >= 1) setStage("completed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tracking update failed");
    }
  }

  // Auto-advance trip every 3 seconds when tracking
  React.useEffect(() => {
    if (stage !== "tracking" || !trip) return;
    const interval = setInterval(advanceTrip, 3000);
    return () => clearInterval(interval);
  }, [stage, trip]);

  function reset() {
    setStage("search");
    setResult(null);
    setTrip(null);
    setSelectedOffer(null);
    setSelectedBid(null);
    setCompilerTrace([]);
    setError(null);
  }

  // ── The persistent map (SVG-based, never unmounts) ──
  function renderMap() {
    const route = result?.route;
    const points = route?.points ?? [];
    const tripRoute = trip?.route ?? [];

    // Project lat/lng to SVG coordinates (simplified)
    const allPoints = [...points, ...tripRoute, origin, destination];
    if (trip) allPoints.push(trip.driverLocation);
    const lats = allPoints.map((p) => p.lat);
    const lngs = allPoints.map((p) => p.lng);
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;
    const minLng = Math.min(...lngs) - 0.005;
    const maxLng = Math.max(...lngs) + 0.005;
    const project = (p: { lat: number; lng: number }) => ({
      x: ((p.lng - minLng) / (maxLng - minLng)) * 400 + 20,
      y: 320 - ((p.lat - minLat) / (maxLat - minLat)) * 300 + 20,
    });

    const routePath = points.length > 1
      ? "M " + points.map((p) => { const pp = project(p); return `${pp.x},${pp.y}`; }).join(" L ")
      : "";

    const altRoutePath = route?.alternatives?.[0] && route.alternatives[0].points.length > 1
      ? "M " + route.alternatives[0].points.map((p) => { const pp = project(p); return `${pp.x},${pp.y}`; }).join(" L ")
      : "";

    const originP = project(origin);
    const destP = project(destination);
    const driverP = trip ? project(trip.driverLocation) : null;

    return (
      <div className="relative w-full h-full bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
        <svg viewBox="0 0 440 360" className="w-full h-full">
          {/* Grid background */}
          {[0, 80, 160, 240, 320, 400].map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={360} stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-700" />
          ))}
          {[0, 80, 160, 240, 320].map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={440} y2={y} stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-700" />
          ))}

          {/* Alternative route */}
          {altRoutePath && (
            <path d={altRoutePath} fill="none" stroke="#94a3b8" strokeWidth="3" strokeDasharray="6,4" opacity="0.5" />
          )}

          {/* Main route */}
          {routePath && (
            <path
              d={routePath}
              fill="none"
              stroke={route?.trafficLevel === "high" ? "#ef4444" : route?.trafficLevel === "medium" ? "#f59e0b" : "#10b981"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Origin marker */}
          <circle cx={originP.x} cy={originP.y} r="6" fill="#3b82f6" stroke="white" strokeWidth="2" />
          <text x={originP.x + 10} y={originP.y + 4} className="text-[10px] fill-slate-700 dark:fill-slate-300">A</text>

          {/* Destination marker */}
          <circle cx={destP.x} cy={destP.y} r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
          <text x={destP.x + 10} y={destP.y + 4} className="text-[10px] fill-slate-700 dark:fill-slate-300">B</text>

          {/* Driver marker */}
          {driverP && (
            <g>
              <circle cx={driverP.x} cy={driverP.y} r="8" fill="#10b981" stroke="white" strokeWidth="2" />
              <text x={driverP.x - 3} y={driverP.y + 3} className="text-[10px] fill-white font-bold">🚗</text>
            </g>
          )}
        </svg>

        {/* Route info overlay */}
        {route && (
          <div className="absolute top-2 left-2 bg-white dark:bg-slate-800 rounded-md px-3 py-1.5 text-xs shadow-md">
            <span className="font-mono">{(route.distance / 1000).toFixed(1)} km</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="font-mono">{Math.round(route.duration / 60)} min</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className={route.trafficLevel === "high" ? "text-red-500" : route.trafficLevel === "medium" ? "text-amber-500" : "text-emerald-500"}>
              {route.trafficLevel} traffic
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Bottom sheet content (driven by Experience Runtime state) ──
  function renderBottomSheet() {
    return (
      <div className="bg-background border-t rounded-t-2xl shadow-lg p-4 space-y-4 max-h-[50vh] overflow-y-auto">
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
            <span className="ml-2 text-sm text-muted-foreground">Executing compiler pipeline...</span>
          </div>
        )}

        {/* SEARCH STAGE — dispatches a Mobility Intent */}
        {stage === "search" && !loading && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Where to?</h2>
            <p className="text-xs text-muted-foreground">Every search publishes a Mobility Intent through the compiler. No booking happens here — the marketplace evaluates all providers.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                Origin Lat
                <input type="number" step="0.0001" value={origin.lat} onChange={(e) => setOrigin({ ...origin, lat: parseFloat(e.target.value) })} className="w-full mt-1 px-2 py-1.5 rounded-md border bg-transparent text-sm" />
              </label>
              <label className="text-xs">
                Origin Lng
                <input type="number" step="0.0001" value={origin.lng} onChange={(e) => setOrigin({ ...origin, lng: parseFloat(e.target.value) })} className="w-full mt-1 px-2 py-1.5 rounded-md border bg-transparent text-sm" />
              </label>
              <label className="text-xs">
                Dest Lat
                <input type="number" step="0.0001" value={destination.lat} onChange={(e) => setDestination({ ...destination, lat: parseFloat(e.target.value) })} className="w-full mt-1 px-2 py-1.5 rounded-md border bg-transparent text-sm" />
              </label>
              <label className="text-xs">
                Dest Lng
                <input type="number" step="0.0001" value={destination.lng} onChange={(e) => setDestination({ ...destination, lng: parseFloat(e.target.value) })} className="w-full mt-1 px-2 py-1.5 rounded-md border bg-transparent text-sm" />
              </label>
            </div>
            <label className="text-xs">
              Budget (USD)
              <input type="number" value={budget} onChange={(e) => setBudget(parseFloat(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded-md border bg-transparent text-sm" />
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={pooling} onChange={(e) => setPooling(e.target.checked)} />
                Pooling
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={corporateRate} onChange={(e) => setCorporateRate(e.target.checked)} />
                Corporate Rate
              </label>
            </div>
            <button onClick={searchRide} className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors">
              🔍 Search Mobility — Publish Intent
            </button>
            <button onClick={publishParcel} className="w-full py-2.5 rounded-lg bg-amber-600 text-white font-medium text-sm hover:bg-amber-700 transition-colors">
              📦 Send Parcel — Open Marketplace
            </button>
          </div>
        )}

        {/* RESULTS STAGE — marketplace offers (one ranked list, never separated by provider) */}
        {stage === "results" && result?.marketplace && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Best Mobility Options</h2>
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">← New Search</button>
            </div>
            <p className="text-xs text-muted-foreground">{result.marketplace.totalProvidersEvaluated} providers evaluated · ONE ranked list</p>

            {/* Compiler trace (proof that every stage executed) */}
            <details className="rounded-md border p-2">
              <summary className="text-xs font-medium cursor-pointer">Compiler Trace ({compilerTrace.length} stages)</summary>
              <div className="mt-2 space-y-1">
                {compilerTrace.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px]">
                    <span className={s.status === "completed" ? "text-emerald-500" : "text-red-500"}>{s.status === "completed" ? "✓" : "✗"}</span>
                    <span className="font-mono text-muted-foreground">{s.stage}</span>
                    <span className="text-foreground/70">{s.detail}</span>
                  </div>
                ))}
              </div>
            </details>

            {/* Offers — ONE ranked list */}
            <div className="space-y-2">
              {result.marketplace.offers.map((offer, i) => (
                <div key={offer.id} className={`rounded-lg border p-3 ${i === 0 ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{offer.provider}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground uppercase">{offer.providerType}</span>
                      {i === 0 && <span className="ml-2 text-[10px] text-emerald-600 font-medium">★ BEST</span>}
                    </div>
                    <span className="font-mono text-sm font-semibold">${offer.fare.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>⏱ {Math.round(offer.etaSeconds / 60)} min</span>
                    <span>⭐ {offer.rating}</span>
                    <span>🚗 {offer.vehicleType}</span>
                    {offer.poolingAvailable && <span>👥 Pooling</span>}
                    {offer.poolingDiscount && <span className="text-emerald-600">-{(offer.poolingDiscount * 100).toFixed(0)}%</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{offer.rationale}</p>
                  <button
                    onClick={() => { setSelectedOffer(offer); confirmRide(offer); }}
                    className="w-full mt-2 py-1.5 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                  >
                    Confirm {offer.provider} — ${offer.fare.toFixed(2)}
                  </button>
                </div>
              ))}
            </div>

            {/* Explainability — from compiler artifacts, not generated in UI */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
              <h3 className="text-xs font-medium">Why this recommendation?</h3>
              <p className="text-xs text-foreground/80">{result.recommendation.explanation}</p>
              {result.recommendation.whyNot.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">Why not alternatives?</p>
                  {result.recommendation.whyNot.map((wn, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground">
                      <span className="font-mono">{wn.provider}:</span> {wn.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PARCEL BIDS STAGE — live marketplace bidding */}
        {stage === "parcel-bids" && result?.parcelBidding && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">📦 Parcel Bids</h2>
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">← New Search</button>
            </div>
            <p className="text-xs text-muted-foreground">{result.parcelBidding.totalBids} bids from couriers, fleets, and independent drivers</p>

            {/* Compiler trace */}
            <details className="rounded-md border p-2">
              <summary className="text-xs font-medium cursor-pointer">Compiler Trace ({compilerTrace.length} stages)</summary>
              <div className="mt-2 space-y-1">
                {compilerTrace.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px]">
                    <span className={s.status === "completed" ? "text-emerald-500" : "text-red-500"}>{s.status === "completed" ? "✓" : "✗"}</span>
                    <span className="font-mono text-muted-foreground">{s.stage}</span>
                    <span className="text-foreground/70">{s.detail}</span>
                  </div>
                ))}
              </div>
            </details>

            {/* Live bids */}
            <div className="space-y-2">
              {result.parcelBidding.bids.map((bid, i) => (
                <div key={bid.id} className={`rounded-lg border p-3 ${i === 0 ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{bid.provider}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground uppercase">{bid.providerType}</span>
                      {result.parcelBidding!.recommendedBid?.provider === bid.provider && (
                        <span className="ml-2 text-[10px] text-emerald-600 font-medium">★ RECOMMENDED</span>
                      )}
                    </div>
                    <span className="font-mono text-sm font-semibold">${bid.fare.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>⏱ {Math.round(bid.etaSeconds / 60)} min</span>
                    <span>⭐ {bid.rating}</span>
                  </div>
                  <button
                    onClick={() => acceptBid(bid)}
                    className="w-full mt-2 py-1.5 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                  >
                    Accept {bid.provider} — ${bid.fare.toFixed(2)}
                  </button>
                </div>
              ))}
            </div>

            {/* Explainability */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <h3 className="text-xs font-medium">Why this recommendation?</h3>
              <p className="text-xs text-foreground/80 mt-1">{result.recommendation.explanation}</p>
            </div>
          </div>
        )}

        {/* PARCEL ACCEPTED */}
        {stage === "parcel-accepted" && selectedBid && (
          <div className="space-y-3 text-center py-4">
            <div className="text-4xl">📦✅</div>
            <h2 className="text-lg font-semibold">Bid Accepted!</h2>
            <p className="text-sm text-muted-foreground">{selectedBid.provider} is preparing pickup.</p>
            <p className="font-mono text-2xl font-semibold">${selectedBid.fare.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">ETA: {Math.round(selectedBid.etaSeconds / 60)} min</p>
            <button onClick={reset} className="w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium">Done</button>
          </div>
        )}

        {/* TRACKING STAGE — live trip tracking */}
        {stage === "tracking" && trip && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Trip in Progress</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700">{trip.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-[10px] text-muted-foreground">Driver</div>
                <div className="text-sm font-medium">{trip.driverName}</div>
                <div className="text-xs text-muted-foreground">⭐ {trip.driverRating}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[10px] text-muted-foreground">Vehicle</div>
                <div className="text-sm font-medium">{trip.vehicleModel}</div>
                <div className="text-xs font-mono">{trip.vehiclePlate}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-[10px] text-muted-foreground">ETA</div>
                <div className="text-xl font-mono font-semibold">{Math.round(trip.eta / 60)} min</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-[10px] text-muted-foreground">Fare</div>
                <div className="text-xl font-mono font-semibold">${trip.fare.toFixed(2)}</div>
              </div>
            </div>
            {/* Progress bar */}
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Progress: {(trip.progress * 100).toFixed(0)}%</div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${trip.progress * 100}%` }} />
              </div>
            </div>
            <button onClick={() => { setStage("completed"); }} className="w-full py-2 rounded-lg border border-red-500/30 text-red-600 text-sm font-medium hover:bg-red-500/10 transition-colors">
              End Trip (Simulated)
            </button>
          </div>
        )}

        {/* COMPLETED */}
        {stage === "completed" && (
          <div className="space-y-3 text-center py-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-semibold">Trip Completed</h2>
            {trip && <p className="font-mono text-2xl font-semibold">${trip.fare.toFixed(2)}</p>}
            <p className="text-xs text-muted-foreground">Payment settled via PaySwap</p>
            <button onClick={reset} className="w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium">New Trip</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-orange-500 text-white grid place-items-center font-mono font-bold text-xs">O</div>
            <div className="leading-tight">
              <div className="font-semibold text-sm">Oryx Mobility</div>
              <div className="text-[10px] text-muted-foreground">Buy mobility, not rides</div>
            </div>
          </div>
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground">← Control Plane</a>
        </div>
      </header>

      {/* Persistent map (never unmounts) + Bottom sheet */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-2 min-h-[300px]">
          {renderMap()}
        </div>
        <div className="flex-shrink-0">
          {renderBottomSheet()}
        </div>
      </main>
    </div>
  );
}
