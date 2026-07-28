import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";

export async function GET() {
  const rt = getKernelRuntime();
  const apps = rt.appLifecycle.list();
  return NextResponse.json({ applications: apps });
}
