"use client";

import * as React from "react";

/**
 * Eks-Clean Application — a real running application on OpsOS.
 *
 * This is NOT an inspector. This is an operational application that:
 * - Creates cleaning jobs (dispatches Mobility Intents through the compiler)
 * - Executes the full workflow: Book → Compile → Knowledge → Coordinate →
 *   Assign → Execute → Complete
 * - Shows live job state mutated by real API calls
 * - Every button performs a real action
 *
 * The application is launched by navigating to /apps/eks-clean from the
 * Control Plane's Applications tab.
 */

interface CleaningJob {
  id: string;
  applicationId: string;
  protocolId: string;
  customerName: string;
  address: string;
  taskType: string;
  status: "pending" | "compiling" | "compiled" | "matching" | "assigned" | "in-progress" | "completed" | "cancelled";
  cleanerId?: string;
  cleanerName?: string;
  assignedAt?: number;
  completedAt?: number;
  stages: { stage: string; status: string; detail: string; at: number }[];
  knowledgeRefs: string[];
  createdAt: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-300",
  compiling: "bg-blue-100 text-blue-700 border-blue-300",
  compiled: "bg-blue-100 text-blue-700 border-blue-300",
  matching: "bg-purple-100 text-purple-700 border-purple-300",
  assigned: "bg-cyan-100 text-cyan-700 border-cyan-300",
  "in-progress": "bg-indigo-100 text-indigo-700 border-indigo-300",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  cancelled: "bg-red-100 text-red-700 border-red-300",
};

export default function EksCleanApp() {
  const [jobs, setJobs] = React.useState<CleaningJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<CleaningJob | null>(null);

  // Form state
  const [customerName, setCustomerName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [taskType, setTaskType] = React.useState("routine");

  // Load jobs on mount
  React.useEffect(() => {
    loadJobs();
  }, []);

  // Auto-refresh every 3s
  React.useEffect(() => {
    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  async function loadJobs() {
    try {
      const res = await fetch("/api/cleaning/jobs?applicationId=eks-clean");
      const data = await res.json();
      if (data.ok) {
        setJobs(data.jobs);
        if (selectedJob) {
          const updated = data.jobs.find((j: CleaningJob) => j.id === selectedJob.id);
          if (updated) setSelectedJob(updated);
        }
      }
    } catch {}
  }

  async function createJob() {
    if (!customerName || !address) {
      setToast({ msg: "Customer name and address are required", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cleaning/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: "eks-clean", customerName, address, taskType }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast({ msg: `Job created: ${data.job.id} — ${data.job.cleanerName} assigned`, type: "success" });
        setCustomerName("");
        setAddress("");
        loadJobs();
      } else {
        setToast({ msg: data.error || "Failed to create job", type: "error" });
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed", type: "error" });
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function advanceJob(jobId: string) {
    try {
      const res = await fetch("/api/cleaning/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", jobId }),
      });
      const data = await res.json();
      if (data.ok) loadJobs();
    } catch {}
  }

  async function cancelJob(jobId: string) {
    try {
      await fetch("/api/cleaning/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", jobId }),
      });
      loadJobs();
    } catch {}
  }

  const activeJobs = jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled");
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const cancelledJobs = jobs.filter((j) => j.status === "cancelled");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header — Eks-Clean branding */}
      <header className="sticky top-0 z-40 border-b bg-white dark:bg-slate-900 shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg grid place-items-center font-mono font-bold text-white text-sm" style={{ backgroundColor: "#0d9488" }}>E</div>
            <div className="leading-tight">
              <div className="font-semibold text-sm">Eks-Clean</div>
              <div className="text-[10px] text-slate-400">Professional cleaning, on demand.</div>
            </div>
          </div>
          <a href="/" className="text-xs text-slate-400 hover:text-slate-600">← Control Plane</a>
        </div>
        {/* Nav */}
        <div className="px-4 h-10 flex items-center gap-4 border-t text-xs font-medium">
          <span className="text-teal-600 border-b-2 border-teal-600 pb-2">Dashboard</span>
          <span className="text-slate-400">Bookings</span>
          <span className="text-slate-400">Jobs</span>
          <span className="text-slate-400">Cleaners</span>
          <span className="text-slate-400">Marketplace</span>
          <span className="text-slate-400">Reports</span>
          <span className="text-slate-400">AI</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
            <div className="text-[10px] text-slate-400 uppercase">Active Jobs</div>
            <div className="text-2xl font-bold text-teal-600">{activeJobs.length}</div>
          </div>
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
            <div className="text-[10px] text-slate-400 uppercase">Completed</div>
            <div className="text-2xl font-bold text-emerald-600">{completedJobs.length}</div>
          </div>
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
            <div className="text-[10px] text-slate-400 uppercase">Total Jobs</div>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </div>
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
            <div className="text-[10px] text-slate-400 uppercase">Protocol</div>
            <div className="text-sm font-mono text-slate-600">residential v1.0</div>
          </div>
        </div>

        {/* New Cleaning Job form */}
        <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 space-y-3">
          <h2 className="text-sm font-semibold">+ New Cleaning Job</h2>
          <p className="text-[11px] text-slate-400">Dispatches a Cleaning Intent through the OpsOS compiler pipeline: Knowledge lookup → Policy evaluation → Coordination → Assignment → AI explanation</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="px-3 py-2 rounded-md border bg-transparent text-sm"
            />
            <input
              type="text"
              placeholder="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="px-3 py-2 rounded-md border bg-transparent text-sm"
            />
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="px-3 py-2 rounded-md border bg-transparent text-sm"
            >
              <option value="routine">Routine Clean</option>
              <option value="deep-clean">Deep Clean</option>
              <option value="move-in">Move-in / Move-out</option>
              <option value="airbnb">Airbnb Turnover</option>
              <option value="emergency">Emergency Cleanup</option>
            </select>
          </div>
          <button
            onClick={createJob}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: "#0d9488" }}
          >
            {loading ? "Dispatching Intent..." : "Dispatch Cleaning Intent →"}
          </button>
        </div>

        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-600">Active Jobs ({activeJobs.length})</h2>
            {activeJobs.map((job) => (
              <div key={job.id} className="rounded-lg border bg-white dark:bg-slate-900 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{job.customerName}</span>
                    <span className="ml-2 text-xs text-slate-400">{job.address}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[job.status] || ""}`}>
                    {job.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>🧹 {job.taskType}</span>
                  {job.cleanerName && <span>👤 {job.cleanerName}</span>}
                  <span className="font-mono text-[10px]">{job.id}</span>
                </div>
                {/* Compiler trace */}
                <details className="rounded-md border p-2">
                  <summary className="text-[11px] font-medium cursor-pointer text-slate-500">Compiler Trace ({job.stages.length} stages)</summary>
                  <div className="mt-2 space-y-1">
                    {job.stages.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px]">
                        <span className="text-emerald-500">✓</span>
                        <span className="font-mono text-slate-400 w-32 shrink-0">{s.stage}</span>
                        <span className="text-slate-600">{s.detail}</span>
                      </div>
                    ))}
                  </div>
                </details>
                {/* Actions */}
                <div className="flex gap-2">
                  {job.status !== "completed" && job.status !== "cancelled" && (
                    <>
                      <button onClick={() => advanceJob(job.id)} className="px-3 py-1 rounded-md text-xs font-medium border border-teal-500/30 text-teal-700 hover:bg-teal-500/10">Advance →</button>
                      <button onClick={() => cancelJob(job.id)} className="px-3 py-1 rounded-md text-xs font-medium border border-red-500/30 text-red-600 hover:bg-red-500/10">Cancel</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completed Jobs */}
        {completedJobs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400">Completed ({completedJobs.length})</h2>
            {completedJobs.map((job) => (
              <div key={job.id} className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm">{job.customerName}</span>
                  <span className="ml-2 text-xs text-slate-400">{job.taskType}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-300">✓ completed</span>
              </div>
            ))}
          </div>
        )}

        {jobs.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">🧹</div>
            <p className="text-sm">No jobs yet. Dispatch a Cleaning Intent to start.</p>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t bg-white dark:bg-slate-900 py-3 px-4 text-[10px] text-slate-400 flex items-center justify-between">
        <span><span className="font-mono text-slate-600">Eks-Clean</span> · Powered by OpsOS · cleaning.protocol.residential</span>
        <span className="font-mono">{jobs.length} jobs · {activeJobs.length} active</span>
      </footer>
    </div>
  );
}
