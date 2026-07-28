import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";

export async function GET() {
  const rt = getKernelRuntime();
  const packages = rt.composition.registry.list();
  return NextResponse.json({
    packages: packages.map((p) => ({
      id: p.manifest.id,
      version: p.manifest.version,
      digest: p.digest.hash,
      signed: !!p.signature,
    })),
  });
}
