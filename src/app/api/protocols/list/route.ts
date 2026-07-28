import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";

export async function GET() {
  const rt = getKernelRuntime();
  const protocols = rt.protocolLifecycle.list().map((p) => ({
    id: p.manifest.id,
    name: p.manifest.name,
    displayName: p.manifest.displayName,
    version: p.manifest.version,
    state: p.state,
    contributions: rt.protocolRegistry.contributionCounts(p.manifest.id),
  }));

  return NextResponse.json({ protocols });
}
