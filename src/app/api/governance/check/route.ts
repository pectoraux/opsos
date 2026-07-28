import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, fromVersion, toVersion } = body;
    const rt = getKernelRuntime();

    switch (action) {
      case "check-compatibility": {
        const results = rt.governance.compatibilityEngine.check([
          {
            dimension: "protocol-kernel",
            source: { kind: "protocol", id: body.sourceId || "opsos.protocol.demo", version: body.sourceVersion || "1.0.0" },
            target: { kind: "kernel", id: "opsos.kernel", version: body.targetVersion || "1.2.0" },
          },
        ]);
        return NextResponse.json({ results });
      }
      case "plan-migration": {
        const plan = rt.governance.migrationEngine.plan(fromVersion, toVersion, body.type || "upgrade");
        const dryRun = rt.governance.migrationEngine.dryRun(plan);
        return NextResponse.json({ plan, dryRun });
      }
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
