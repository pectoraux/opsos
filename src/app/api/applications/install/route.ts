import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, applicationId } = body;
    const rt = getKernelRuntime();

    switch (action) {
      case "activate": {
        const result = rt.appLifecycle.activate(applicationId);
        return NextResponse.json(result);
      }
      case "suspend": {
        const result = rt.appLifecycle.suspend(applicationId);
        return NextResponse.json(result);
      }
      case "archive": {
        const result = rt.appLifecycle.archive(applicationId);
        return NextResponse.json(result);
      }
      case "remove": {
        const result = rt.appLifecycle.remove(applicationId);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
