import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";

export async function GET() {
  const rt = getKernelRuntime();
  const now = rt.clock.now();

  return NextResponse.json({
    status: "healthy",
    kernelVersion: "1.0.0",
    apiVersion: "1.0.0",
    uptime: now - rt.startTime,
    protocolCount: rt.protocolLifecycle.list().length,
    applicationCount: rt.appLifecycle.list().length,
    eventStorePosition: rt.eventStore.globalPosition(),
    timestamp: now,
  });
}
