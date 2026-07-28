import { NextResponse } from "next/server";
import { getKernelRuntime, executeCleaningWorkflow } from "@/lib/kernel-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { applicationId, customerName, address, taskType } = body;
    const rt = getKernelRuntime();

    const job = executeCleaningWorkflow(
      applicationId || "eks-clean",
      customerName || "Customer",
      address || "Unknown address",
      taskType || "routine",
    );

    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
