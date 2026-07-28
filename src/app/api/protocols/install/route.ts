import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, protocolId } = body;

    const rt = getKernelRuntime();

    switch (action) {
      case "discover": {
        // Re-discover the demo protocol (or a provided manifest)
        const result = rt.protocolLifecycle.discover(body.manifest || {
          id: protocolId || "opsos.protocol.demo",
          name: "demo",
          displayName: "Demo Protocol",
          description: "Re-installed demo protocol",
          version: "1.0.0",
          apiVersion: "1.0.0",
          author: { name: "OpsOS" },
          license: "MIT",
          minimumKernelVersion: "1.0.0",
          dependencies: [],
          permissions: [],
          capabilities: ["demo.execute"],
          intentTypes: ["demo.run"],
          extensions: [],
          featureFlags: {},
        });
        return NextResponse.json(result);
      }
      case "validate": {
        const result = rt.protocolLifecycle.validate(protocolId);
        return NextResponse.json(result);
      }
      case "install": {
        const result = rt.protocolLifecycle.install(protocolId);
        return NextResponse.json(result);
      }
      case "enable": {
        const result = rt.protocolLifecycle.enable(protocolId);
        return NextResponse.json(result);
      }
      case "disable": {
        const result = rt.protocolLifecycle.disable(protocolId);
        return NextResponse.json(result);
      }
      case "uninstall": {
        const result = rt.protocolLifecycle.uninstall(protocolId);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
