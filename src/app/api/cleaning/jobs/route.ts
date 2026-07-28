import { NextResponse } from "next/server";
import { getKernelRuntime, listCleaningJobs, advanceCleaningJob } from "@/lib/kernel-runtime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId") || undefined;
  const jobs = listCleaningJobs(applicationId);
  return NextResponse.json({ ok: true, jobs });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, jobId } = body;

    if (action === "advance") {
      const job = advanceCleaningJob(jobId);
      if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
      return NextResponse.json({ ok: true, job });
    }

    if (action === "cancel") {
      const rt = getKernelRuntime();
      const job = rt.cleaningJobs.get(jobId);
      if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
      const updated = { ...job, status: "cancelled" as const };
      rt.cleaningJobs.set(jobId, updated);
      return NextResponse.json({ ok: true, job: updated });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
