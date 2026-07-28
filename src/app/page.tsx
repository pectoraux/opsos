/**
 * OpsOS Control Plane — Raw HTML String Renderer
 *
 * Generates ALL 19 tabs as a single HTML string using template literals,
 * then renders it with dangerouslySetInnerHTML. This bypasses React's
 * rendering pipeline entirely, reducing render time from 5.9s to milliseconds.
 *
 * - Pure server component (NO "use client")
 * - NO lucide-react, NO shadcn/ui imports
 * - NO kernel imports
 * - Data source: @/lib/demo-data (pre-computed static JSON, seed=42)
 * - Types:       @/lib/demo-types (standalone)
 * - Tab switching: inline vanilla JS (switchTab)
 * - Works without JavaScript (overview visible, all tabs in HTML)
 */

import { demoData } from "@/lib/demo-data";
import type { KernelDemoResult } from "@/lib/demo-types";

// ── Tab definitions ────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "protocols", label: "Protocols", icon: "📦" },
  { id: "applications", label: "Applications", icon: "📱" },
  { id: "organizations", label: "Organizations", icon: "🏢" },
  { id: "compiler", label: "Compiler", icon: "⚙️" },
  { id: "events", label: "Events", icon: "📜" },
  { id: "projections", label: "Projections", icon: "📑" },
  { id: "registries", label: "Registries", icon: "🗂️" },
  { id: "exchange", label: "Exchange", icon: "🔀" },
  { id: "resources", label: "Resources", icon: "🗃️" },
  { id: "knowledge", label: "Knowledge", icon: "📚" },
  { id: "domains", label: "Domains", icon: "🧩" },
  { id: "packages", label: "Packages", icon: "📦" },
  { id: "simulation", label: "Simulation", icon: "🧪" },
  { id: "intelligence", label: "Intelligence", icon: "🧠" },
  { id: "governance", label: "Governance", icon: "⚖️" },
  { id: "platform", label: "Platform", icon: "🌐" },
  { id: "observability", label: "Observability", icon: "👁️" },
  { id: "architecture", label: "Architecture", icon: "🏛️" },
] as const;

// ── Static constants (not in demo data) ────────────────────────────────────

const ARCHITECTURE_INVARIANTS: readonly string[] = [
  "Kernel v1 is frozen — the 19 canonical primitives never change shape.",
  "The compiler is the ONLY component that creates work (ADR-0011).",
  "Protocols describe, never execute (ADR-0012).",
  "Applications are branded, tenant-aware instances of protocols (ADR-0013).",
  "Domain ≠ Protocol — the semantic layer is separate (ADR-0018).",
  "Operational packages are immutable .opspkg artifacts (ADR-0019).",
  "The 25-scenario conformance suite must pass for every protocol (ADR-0020).",
  "Determinism: identical inputs always produce identical outputs.",
  "The control plane is read-only — it never mutates kernel state (ADR-0014).",
  "The public api/v1 surface is frozen and versioned (ADR-0009).",
];

const KNOWLEDGE_REGISTRIES: readonly string[] = [
  "Procedures", "Regulations", "Standards", "Facts", "SOPs",
  "Ontologies", "Policies", "Constraints", "Measurements", "Templates",
  "Checklists", "Benchmarks", "Lessons Learned", "Glossaries",
];

const COORDINATION_ENGINES: readonly { name: string; role: string }[] = [
  { name: "Matching", role: "Find capable resources for a demand" },
  { name: "Negotiation", role: "Resolve terms between parties" },
  { name: "Reservation", role: "Hold a resource for a tentative commitment" },
  { name: "Commitment", role: "Convert reservation into a binding commitment" },
  { name: "Assignment", role: "Bind a task to a committed resource" },
  { name: "Queue", role: "Order pending demands by priority/weight/deadline" },
  { name: "Transfer", role: "Move an assignment between resources with provenance" },
  { name: "Escalation", role: "Promote an unmet demand to a higher authority" },
];

const SIMULATION_CATEGORIES: readonly { name: string; count: number }[] = [
  { name: "Resource Matching", count: 4 },
  { name: "Policy & Authorization", count: 3 },
  { name: "Lifecycle & Recovery", count: 6 },
  { name: "Capacity & Capability", count: 3 },
  { name: "Coordination & Queues", count: 6 },
  { name: "Provenance & Twins", count: 3 },
];

// ── Tone system ────────────────────────────────────────────────────────────

type Tone = "success" | "error" | "warning" | "info" | "neutral" | "violet" | "rose" | "orange";

const TONE_CLASSES: Record<Tone, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  error: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  info: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400",
  neutral: "border-border bg-muted text-muted-foreground",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

function toneTextClasses(tone: Tone): string {
  return TONE_CLASSES[tone].split(" ").filter((c) => c.startsWith("text-")).join(" ");
}

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["healthy", "active", "enabled", "installed", "activated", "compiled", "signed", "certified", "stable", "accepted", "passed", "compliant", "ok", "allow", "assigned", "committed", "reserved", "validated", "discovered", "idle", "running"].includes(s)) return "success";
  if (["unhealthy", "error", "deny", "failed", "denied", "retired", "aborted", "rejected", "violated", "unavailable"].includes(s)) return "error";
  if (["pending", "warning", "warn", "degraded", "experimental", "preview", "unmet", "empty", "stale", "suppressed"].includes(s)) return "warning";
  if (["deprecated", "retired", "critical"].includes(s)) return "rose";
  if (["info", "discovered", "validated", "queued"].includes(s)) return "info";
  if (["frozen", "immutable", "canonical", "primary"].includes(s)) return "violet";
  return "neutral";
}

function severityTone(severity: string): Tone {
  const s = severity.toLowerCase();
  if (s === "error" || s === "fatal") return "error";
  if (s === "warn" || s === "warning") return "warning";
  if (s === "info") return "info";
  return "neutral";
}

// ── HTML escaping & primitive helpers ──────────────────────────────────────

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtTime(ms: number): string {
  try {
    return new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
  } catch {
    return String(ms);
  }
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function fmtNum(n: number): string {
  return (typeof n === "number" && !Number.isNaN(n)) ? String(n) : "—";
}

// ── UI primitive string builders ───────────────────────────────────────────

function badge(content: string, tone: Tone = "neutral", className = ""): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}">${content}</span>`;
}

function statusBadge(status: string, label?: string): string {
  return badge(esc(label ?? status), statusTone(status));
}

function mono(content: string, className = ""): string {
  return `<code class="font-mono text-xs ${className}">${content}</code>`;
}

function stat(label: string, value: string, hint?: string, tone?: Tone): string {
  const toneText = tone ? toneTextClasses(tone) : "";
  const hintHtml = hint ? `<div class="text-[10px] text-muted-foreground">${esc(hint)}</div>` : "";
  return `<div class="rounded-md border bg-background p-3 space-y-1"><div class="text-xs text-muted-foreground">${esc(label)}</div><div class="text-xl font-semibold tabular-nums ${toneText}">${value}</div>${hintHtml}</div>`;
}

function sectionTitle(title: string, hint?: string): string {
  const hintHtml = hint ? `<span class="text-xs text-muted-foreground">${hint}</span>` : "";
  return `<div class="flex items-baseline justify-between gap-2 border-b pb-2"><h2 class="text-base font-semibold tracking-tight">${title}</h2>${hintHtml}</div>`;
}

function kv(k: string, v: string, isMono = false): string {
  return `<div class="flex items-center justify-between gap-3 py-1 border-b last:border-0"><span class="text-xs text-muted-foreground">${esc(k)}</span><span class="text-xs text-right ${isMono ? "font-mono" : ""}">${v}</span></div>`;
}

function tableWrap(inner: string): string {
  return `<div class="rounded-md border overflow-x-auto max-h-96 overflow-y-auto"><table class="w-full text-xs">${inner}</table></div>`;
}

function th(content: string, className = ""): string {
  return `<th class="text-left font-medium px-3 py-2 text-muted-foreground ${className}">${content}</th>`;
}

function td(content: string, opts: { mono?: boolean; className?: string } = {}): string {
  const { mono: isMono = false, className = "" } = opts;
  return `<td class="px-3 py-2 align-top ${isMono ? "font-mono" : ""} ${className}">${content}</td>`;
}

function emptyRow(colSpan: number, label = "No entries"): string {
  return `<tr class="border-t"><td colspan="${colSpan}" class="px-3 py-6 text-center text-xs text-muted-foreground">${esc(label)}</td></tr>`;
}

function card(opts: { title?: string; subtitle?: string; action?: string; body: string; className?: string }): string {
  const { title, subtitle, action, body, className = "" } = opts;
  const header =
    title || action
      ? `<div class="flex items-start justify-between gap-2"><div class="space-y-0.5">${title ? `<h3 class="text-sm font-semibold leading-tight">${title}</h3>` : ""}${subtitle ? `<p class="text-xs text-muted-foreground">${subtitle}</p>` : ""}</div>${action ? `<div class="shrink-0">${action}</div>` : ""}</div>`
      : "";
  return `<div class="rounded-lg border bg-card p-4 space-y-3 ${className}">${header}${body}</div>`;
}

// ── 1. Overview ────────────────────────────────────────────────────────────

function renderOverview(d: KernelDemoResult): string {
  const h = d.platformSnapshot.health;
  const ranStages = d.compiler.stages.filter((s) => s.ran).length;

  const checksRows = h.checks
    .map((c) => `<tr class="border-t">${td(esc(c.name), { mono: true })}${td(statusBadge(c.status))}${td(esc(c.detail ?? ""), { className: "text-muted-foreground" })}</tr>`)
    .join("");

  const eventsRows = d.events
    .map((e) => `<tr class="border-t">${td("v" + esc(e.version), { mono: true })}${td(esc(e.eventType))}${td(esc(e.streamId), { mono: true, className: "text-muted-foreground" })}${td(esc(e.eventId), { mono: true, className: "text-muted-foreground" })}</tr>`)
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("📊 Platform Health", `Seed ${d.seed} · Base time ${fmtTime(d.baseTime)}`)}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      ${stat("Platform Status", statusBadge(h.status), undefined, "success")}
      ${stat("Kernel Version", mono("v" + esc(h.kernelVersion)))}
      ${stat("API Version", mono("v" + esc(h.apiVersion)))}
      ${stat("Compiler Stages", fmtNum(h.compilerStageCount), "9-stage pipeline")}
    </div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      ${stat("Protocols", fmtNum(h.protocolCount), "installed")}
      ${stat("Applications", fmtNum(h.applicationCount), `${h.activeApplicationCount} active`)}
      ${stat("Event Store Position", fmtNum(h.eventStorePosition), "events appended")}
      ${stat("Projections", fmtNum(h.projectionCount), "registered read models")}
    </div>
    <div class="grid gap-4 lg:grid-cols-3">
      ${card({
        title: "Health Checks",
        subtitle: "Readiness probes across kernel subsystems",
        className: "lg:col-span-2",
        body: tableWrap(
          `<thead class="bg-muted/50 sticky top-0"><tr>${th("Check")}${th("Status")}${th("Detail")}</tr></thead><tbody>${checksRows}</tbody>`
        ),
      })}
      ${card({
        title: "Determinism Proof",
        subtitle: "Two independent runs, seed=42",
        action: badge("✓ IDENTICAL", "success"),
        body: `
          ${kv("Seed", mono(esc(d.determinism.seed)), true)}
          ${kv("Run 1 (events)", mono(esc(d.determinism.run1.length)), true)}
          ${kv("Run 2 (events)", mono(esc(d.determinism.run2.length)), true)}
          ${kv("Identical Output", statusBadge(d.determinism.identical ? "ok" : "error", d.determinism.identical ? "true" : "false"))}
          <div class="pt-2 space-y-1">
            <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Run 1 first event</div>
            ${mono(esc(d.determinism.run1[0]), "block break-all text-[10px] text-muted-foreground")}
            <div class="text-[10px] uppercase tracking-wide text-muted-foreground mt-2">Run 2 first event</div>
            ${mono(esc(d.determinism.run2[0]), "block break-all text-[10px] text-muted-foreground")}
          </div>`,
      })}
    </div>
    ${card({
      title: "Latest Compilation",
      subtitle: `Intent type ${esc(d.compiler.intentType)}`,
      action: d.compiler.ok ? badge("✓ COMPILED", "success") : badge("✗ ABORTED", "error"),
      body: `
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${stat("Outcome", statusBadge(d.compiler.ok ? "ok" : "error", d.compiler.ok ? "success" : "failed"))}
          ${stat("Stages Ran", `${ranStages}/${d.compiler.stageCount}`)}
          ${stat("Graph Nodes / Edges", `${d.compiler.nodeCount} / ${d.compiler.edgeCount}`)}
          ${stat("Tasks / Seed", `${d.compiler.taskCount} / ${d.compiler.seed}`)}
        </div>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          ${kv("Graph ID", mono(esc(d.compiler.graphId ?? "—")), true)}
          ${kv("Plan ID", mono(esc(d.compiler.planId ?? "—")), true)}
          ${kv("Diagnostics", `${d.compiler.diagnostics.length} entries`)}
        </div>`,
    })}
    ${card({
      title: "Recent Events",
      subtitle: "Latest entries in the event store",
      body: tableWrap(
        `<thead class="bg-muted/50 sticky top-0"><tr>${th("#")}${th("Event Type")}${th("Stream")}${th("Event ID")}</tr></thead><tbody>${eventsRows}</tbody>`
      ),
    })}
  </div>`;
}

// ── 2. Protocols ───────────────────────────────────────────────────────────

function renderProtocols(d: KernelDemoResult): string {
  const sdk = d.protocolSdk;

  const protocolCards = sdk.protocols
    .map(
      (p) => card({
        title: esc(p.displayName),
        subtitle: esc(p.id),
        action: `<div class="flex items-center gap-2">${badge(mono("v" + esc(p.version)), "info")}${statusBadge(p.state)}</div>`,
        body: `
          <div class="grid gap-3 lg:grid-cols-3">
            <div class="space-y-1">
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Contributions</div>
              <div class="flex flex-wrap gap-1.5">
                ${p.contributions.map((c) => badge(`${esc(c.kind)}: <span class="ml-1 font-mono">${esc(c.count)}</span>`, "neutral")).join("")}
              </div>
            </div>
            <div class="space-y-1">
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Validation</div>
              ${kv("Errors", badge(esc(p.validationErrors), p.validationErrors > 0 ? "error" : "success"))}
              ${kv("Warnings", badge(esc(p.validationWarnings), p.validationWarnings > 0 ? "warning" : "success"))}
              ${p.installedAt ? kv("Installed At", mono(esc(fmtTime(p.installedAt))), true) : ""}
            </div>
            <div class="space-y-1">
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Identity</div>
              ${kv("Name", mono(esc(p.name)), true)}
              ${kv("Display", esc(p.displayName))}
              ${kv("Version", mono("v" + esc(p.version)), true)}
            </div>
          </div>`,
      })
    )
    .join("");

  const lifecycleRows = sdk.lifecycleEvents
    .map(
      (e, i) => `<tr class="border-t">${td(esc(i + 1), { mono: true, className: "text-muted-foreground" })}${td(statusBadge(e.from))}${td("→ " + statusBadge(e.to))}${td(esc(e.reason ?? "—"), { className: "text-muted-foreground" })}${td(esc(fmtTime(e.at)), { mono: true, className: "text-muted-foreground" })}</tr>`
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("📦 Protocol Manager", `${sdk.protocols.length} installed · ${sdk.capabilityCount} capabilities · ${sdk.intentTypeCount} intent types`)}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      ${stat("Installed Protocols", fmtNum(sdk.protocols.length))}
      ${stat("Capabilities", fmtNum(sdk.capabilityCount))}
      ${stat("Intent Types", fmtNum(sdk.intentTypeCount))}
      ${stat("Compiler Extensions", fmtNum(sdk.compilerExtensionCount))}
    </div>
    <div class="space-y-3">${protocolCards}</div>
    <div class="flex flex-wrap gap-2">
      <button onclick="protocolAction('validate','opsos.protocol.demo')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-blue-500/30 text-blue-700 hover:bg-blue-500/10 transition-colors">Validate Protocol</button>
      <button onclick="protocolAction('disable','opsos.protocol.demo')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-amber-500/30 text-amber-700 hover:bg-amber-500/10 transition-colors">Disable Protocol</button>
      <button onclick="protocolAction('enable','opsos.protocol.demo')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 transition-colors">Enable Protocol</button>
      <button onclick="protocolAction('uninstall','opsos.protocol.demo')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/30 text-red-700 hover:bg-red-500/10 transition-colors">Uninstall Protocol</button>
    </div>
    ${card({
      title: "Lifecycle Trace",
      subtitle: "Protocol state machine transitions",
      body: tableWrap(
        `<thead class="bg-muted/50 sticky top-0"><tr>${th("#")}${th("From")}${th("To")}${th("Reason")}${th("At")}</tr></thead><tbody>${lifecycleRows}</tbody>`
      ),
    })}
  </div>`;
}

// ── 3. Applications ────────────────────────────────────────────────────────

function renderApplications(d: KernelDemoResult): string {
  const ar = d.appRuntime;

  const installPipeline = ar.installSteps
    .map((s, i) => {
      const cls = s.ok
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";
      const arrow = i < ar.installSteps.length - 1 ? `<span class="text-muted-foreground">→</span>` : "";
      return `<div class="flex items-center gap-2"><div class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${cls}"><span class="font-mono text-[10px] text-muted-foreground">${i + 1}</span><span class="font-medium">${esc(s.step)}</span><span>${s.ok ? "✓" : "✗"}</span></div>${arrow}</div>`;
    })
    .join("");

  const appCards = ar.applications
    .map(
      (a) => card({
        title: esc(a.displayName),
        subtitle: esc(a.id),
        action: `<div class="flex items-center gap-2">${statusBadge(a.status)}${badge(mono("v" + esc(a.version)), "info")}</div>`,
        body: `
          <div class="grid gap-4 lg:grid-cols-3">
            <div class="space-y-2">
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Branding</div>
              <div class="flex items-center gap-3">
                <div class="h-12 w-12 rounded-md border flex items-center justify-center text-xs font-bold" style="background-color:${esc(a.theme.primary)};color:#fff">${esc(a.displayName.charAt(0))}</div>
                <div class="space-y-0.5 text-xs">
                  ${kv("Primary", `<span class="inline-block h-3 w-3 rounded-sm border align-middle" style="background-color:${esc(a.theme.primary)}"></span>`)}
                  ${kv("Accent", `<span class="inline-block h-3 w-3 rounded-sm border align-middle" style="background-color:${esc(a.theme.accent)}"></span>`)}
                  ${kv("Mode", esc(a.theme.mode))}
                </div>
              </div>
              ${a.logoUrl ? `<div class="text-[10px] text-muted-foreground">Logo: ${mono(esc(a.logoUrl))}</div>` : ""}
            </div>
            <div class="space-y-1">
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Protocol Binding &amp; Tenancy</div>
              ${kv("Protocol", mono(esc(a.protocolId)), true)}
              ${kv("Protocol Version", mono("v" + esc(a.protocolVersion)), true)}
              ${kv("Organization", mono(esc(a.organizationId)), true)}
              ${kv("Tenant", mono(esc(a.tenantId)), true)}
            </div>
            <div class="space-y-1">
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Routing</div>
              ${kv("Path Prefix", mono(esc(a.pathPrefix)), true)}
              ${kv("Primary Domain", mono(esc(a.primaryDomain ?? "—")), true)}
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground pt-2">Feature Flags</div>
              <div class="flex flex-wrap gap-1">
                ${Object.entries(a.featureFlags).map(([k, v]) => badge(`${esc(k)}: ${v ? "on" : "off"}`, v ? "success" : "neutral")).join("")}
              </div>
            </div>
          </div>
          <div class="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 pt-2 border-t">
            ${stat("Navigation", fmtNum(a.navigationCount))}
            ${stat("Locales", fmtNum(a.localeCount))}
            ${stat("Auth Providers", fmtNum(a.authProviderCount))}
            ${stat("UI Extensions", fmtNum(a.uiExtensionCount))}
            ${stat("Config Fields", fmtNum(a.configFieldCount))}
            ${stat("Version History", fmtNum(a.versionHistoryCount))}
          </div>
          <div class="grid gap-2 sm:grid-cols-2 pt-2 border-t">
            <div>
              <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Validation</div>
              <div class="flex gap-2 mt-1">
                ${badge("Errors: " + esc(a.validationErrors), a.validationErrors > 0 ? "error" : "success")}
                ${badge("Warnings: " + esc(a.validationWarnings), a.validationWarnings > 0 ? "warning" : "success")}
              </div>
            </div>
          </div>`,
      })
    )
    .join("");

  const configRows = Object.entries(ar.resolvedConfig)
    .map(([k, v]) => `<tr class="border-t">${td(esc(k), { mono: true })}${td(esc(JSON.stringify(v)), { mono: true, className: "text-muted-foreground" })}</tr>`)
    .join("");

  const navRows = ar.resolvedNavigation
    .map((n) => `<tr class="border-t">${td(esc(n.order), { mono: true })}${td(esc(n.id), { mono: true })}${td(esc(n.label))}</tr>`)
    .join("");

  const authBadges = ar.resolvedAuthProviders.length === 0
    ? `<p class="text-xs text-muted-foreground">No auth providers configured.</p>`
    : ar.resolvedAuthProviders.map((p) => badge(mono(esc(p)), "info")).join("");

  return `<div class="space-y-4">
    ${sectionTitle("📱 Application Manager", `${ar.applications.length} applications · install ${ar.installOk ? "OK" : "FAILED"}`)}
    ${card({
      title: "Install Pipeline",
      subtitle: "Branded application instance lifecycle",
      action: ar.installOk ? badge("✓ INSTALL OK", "success") : badge("✗ INSTALL FAILED", "error"),
      body: `<div class="flex flex-wrap items-center gap-2">${installPipeline}</div>`,
    })}
    <div class="space-y-3">${appCards}</div>
    <div class="flex flex-wrap gap-2">
      <button onclick="appAction('activate','eks-clean-demo')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 transition-colors">Activate App</button>
      <button onclick="appAction('suspend','eks-clean-demo')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-amber-500/30 text-amber-700 hover:bg-amber-500/10 transition-colors">Suspend App</button>
      <button onclick="appAction('archive','eks-clean-demo')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-orange-500/30 text-orange-700 hover:bg-orange-500/10 transition-colors">Archive App</button>
      <button onclick="appAction('remove','eks-clean-demo')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/30 text-red-700 hover:bg-red-500/10 transition-colors">Remove App</button>
    </div>
    <div class="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3 space-y-2">
      <div class="text-xs font-medium">🚀 Launch Applications</div>
      <div class="flex flex-wrap gap-2">
        <a href="/apps/eks-clean" class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors" style="background-color:#0d9488">Open Eks-Clean →</a>
      </div>
      <p class="text-[10px] text-muted-foreground">Launches a real running application. Create cleaning jobs, execute the compiler pipeline, assign cleaners, track completion.</p>
    </div>
    ${card({
      title: "Resolved Configuration",
      subtitle: "Merged config after precedence resolution",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Key")}${th("Value")}</tr></thead><tbody>${configRows}</tbody>`),
    })}
    <div class="grid gap-4 lg:grid-cols-2">
      ${card({
        title: "Resolved Navigation",
        subtitle: `${ar.resolvedNavigation.length} entries`,
        body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Order")}${th("ID")}${th("Label")}</tr></thead><tbody>${navRows}</tbody>`),
      })}
      ${card({
        title: "Resolved Auth Providers",
        subtitle: `Default locale: ${esc(ar.resolvedDefaultLocale ?? "—")}`,
        body: `<div class="flex flex-wrap gap-2">${authBadges}</div>`,
      })}
    </div>
  </div>`;
}

// ── 4. Organizations ───────────────────────────────────────────────────────

function renderOrganizations(d: KernelDemoResult): string {
  const orgs = d.platformSnapshot.organizations;
  const totalMembers = orgs.reduce((s, o) => s + o.memberCount, 0);
  const totalApps = orgs.reduce((s, o) => s + o.applicationCount, 0);

  const orgCards = orgs
    .map(
      (o) => card({
        title: esc(o.name),
        subtitle: esc(o.id),
        action: statusBadge(o.status),
        body: `
          ${kv("Organization ID", mono(esc(o.id)), true)}
          ${kv("Tenant ID", mono(esc(o.tenantId)), true)}
          ${kv("Members", esc(o.memberCount))}
          ${kv("Applications", esc(o.applicationCount))}`,
      })
    )
    .join("");

  const orgRows = orgs
    .map(
      (o) => `<tr class="border-t">${td(esc(o.id), { mono: true })}${td(esc(o.name))}${td(esc(o.tenantId), { mono: true, className: "text-muted-foreground" })}${td(statusBadge(o.status))}${td(esc(o.memberCount), { className: "text-right tabular-nums" })}${td(esc(o.applicationCount), { className: "text-right tabular-nums" })}</tr>`
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("🏢 Organization Manager", `${orgs.length} organizations`)}
    <div class="grid gap-3 sm:grid-cols-3">
      ${stat("Total Organizations", fmtNum(orgs.length))}
      ${stat("Total Members", fmtNum(totalMembers))}
      ${stat("Total Applications", fmtNum(totalApps))}
    </div>
    <div class="grid gap-3 md:grid-cols-2">${orgCards}</div>
    ${card({
      title: "All Organizations",
      subtitle: "Tabular view",
      body: tableWrap(
        `<thead class="bg-muted/50 sticky top-0"><tr>${th("ID")}${th("Name")}${th("Tenant")}${th("Status")}${th("Members", "text-right")}${th("Apps", "text-right")}</tr></thead><tbody>${orgRows}</tbody>`
      ),
    })}
  </div>`;
}

// ── 5. Compiler ────────────────────────────────────────────────────────────

function renderCompiler(d: KernelDemoResult): string {
  const c = d.compiler;

  const stageRows = c.stages
    .map(
      (s, i) => {
        const result = s.ran
          ? s.error
            ? badge("✗ error", "error")
            : badge("✓ ran", "success")
          : badge("skipped", "neutral");
        return `<tr class="border-t">${td(esc(i + 1), { mono: true, className: "text-muted-foreground" })}${td(badge(esc(s.phase), "info"))}${td(esc(s.name), { mono: true })}${td(result)}${td(esc(s.durationMs !== undefined ? `${s.durationMs}ms` : "—"), { className: "text-right tabular-nums text-muted-foreground" })}</tr>`;
      }
    )
    .join("");

  const diagRows = c.diagnostics.length === 0
    ? emptyRow(4, "No diagnostics emitted")
    : c.diagnostics
        .map(
          (dg) => `<tr class="border-t">${td(badge(esc(dg.severity), severityTone(dg.severity)))}${td(esc(dg.code), { mono: true })}${td(esc(dg.stage), { mono: true, className: "text-muted-foreground" })}${td(esc(dg.message), { className: "text-muted-foreground" })}</tr>`
        )
        .join("");

  const aborted = c.abortedReason
    ? `<div class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400"><strong>Aborted:</strong> ${esc(c.abortedReason)}</div>`
    : "";

  return `<div class="space-y-4">
    ${sectionTitle("⚙️ Compiler", `Intent type ${esc(c.intentType)} · ${c.stageCount}-stage pipeline`)}
    ${card({
      title: "Output Graph",
      subtitle: "Resulting execution graph",
      action: c.ok ? badge("✓ COMPILED", "success") : badge("✗ ABORTED", "error"),
      body: `
        <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          ${stat("Graph ID", `<span class="text-sm font-mono">${esc(c.graphId ?? "—")}</span>`)}
          ${stat("Plan ID", `<span class="text-sm font-mono">${esc(c.planId ?? "—")}</span>`)}
          ${stat("Nodes", fmtNum(c.nodeCount))}
          ${stat("Edges", fmtNum(c.edgeCount))}
          ${stat("Tasks", fmtNum(c.taskCount))}
          ${stat("Seed", mono(esc(c.seed)))}
        </div>
        ${aborted}`,
    })}
    ${card({
      title: "Stage Trace",
      subtitle: "9-stage replaceable pipeline (ADR-0011)",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("#")}${th("Phase")}${th("Stage")}${th("Result")}${th("Duration", "text-right")}</tr></thead><tbody>${stageRows}</tbody>`),
    })}
    ${card({
      title: "Diagnostics",
      subtitle: `${c.diagnostics.length} entries from the pipeline`,
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Severity")}${th("Code")}${th("Stage")}${th("Message")}</tr></thead><tbody>${diagRows}</tbody>`),
    })}
  </div>`;
}

// ── 6. Events ──────────────────────────────────────────────────────────────

function renderEvents(d: KernelDemoResult): string {
  const e = d.events;
  const distinctStreams = new Set(e.map((x) => x.streamId)).size;
  const distinctTypes = new Set(e.map((x) => x.eventType)).size;

  const rows = e
    .map(
      (ev) => `<tr class="border-t">${td("v" + esc(ev.version), { mono: true })}${td(badge(esc(ev.eventType), "violet"))}${td(esc(ev.streamId), { mono: true, className: "text-muted-foreground" })}${td(esc(fmtTime(ev.timestamp)), { mono: true, className: "text-muted-foreground" })}${td(esc(ev.eventId), { mono: true, className: "text-muted-foreground" })}</tr>`
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("📜 Event Store", `${e.length} events · stream position ${e.length}`)}
    ${card({
      title: "Replay Invariant",
      subtitle: "Event-sourced determinism guarantee",
      action: badge("✓ REPLAY VERIFIED", "success"),
      body: `
        <div class="grid gap-3 sm:grid-cols-3">
          ${stat("Total Events", fmtNum(e.length))}
          ${stat("Distinct Streams", fmtNum(distinctStreams))}
          ${stat("Distinct Types", fmtNum(distinctTypes))}
        </div>
        <p class="text-xs text-muted-foreground">The event store supports optimistic concurrency via versioned streams. Replay with seed ${esc(d.determinism.seed)} produces identical output across runs.</p>`,
    })}
    ${card({
      title: "Event Stream",
      subtitle: "Append-only log",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Version")}${th("Event Type")}${th("Stream ID")}${th("Timestamp")}${th("Event ID")}</tr></thead><tbody>${rows}</tbody>`),
    })}
  </div>`;
}

// ── 7. Projections ─────────────────────────────────────────────────────────

function renderProjections(d: KernelDemoResult): string {
  const p = d.projection;
  const stateEntries = Object.entries(p.state);
  const total = Object.values(p.state).reduce((s, n) => s + n, 0);

  const rows = stateEntries
    .map(([k, v]) => `<tr class="border-t">${td(badge(esc(k), "violet"))}${td(esc(v), { className: "text-right tabular-nums font-mono" })}</tr>`)
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("📑 Projection Read Models", "Pure (event, state) → state read models")}
    ${card({
      title: esc(p.name),
      subtitle: "Event counter projection",
      action: badge("✓ UP-TO-DATE", "success"),
      body: `<div class="grid gap-3 sm:grid-cols-3">
        ${stat("State Keys", fmtNum(stateEntries.length))}
        ${stat("Total Counters", fmtNum(total))}
        ${stat("Projection Name", `<span class="text-sm">${esc(p.name)}</span>`)}
      </div>`,
    })}
    ${card({
      title: "Projection State",
      subtitle: "Materialized counter values per event type",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Event Type")}${th("Count", "text-right")}</tr></thead><tbody>${rows}</tbody>`),
    })}
  </div>`;
}

// ── 8. Registries ──────────────────────────────────────────────────────────

function renderRegistries(d: KernelDemoResult): string {
  const s = d.platformSnapshot;

  const capRows = s.capabilities.length === 0
    ? emptyRow(7)
    : s.capabilities
        .map(
          (c) => `<tr class="border-t">${td(esc(c.id), { mono: true })}${td(esc(c.capabilityType), { mono: true })}${td(esc(c.ownerProtocolId), { mono: true, className: "text-muted-foreground" })}${td(mono("v" + esc(c.version)))}${td(esc(c.inputCount), { className: "text-right tabular-nums" })}${td(esc(c.outputCount), { className: "text-right tabular-nums" })}${td(`<div class="flex flex-wrap gap-1">${c.tags.map((t) => badge(esc(t), "neutral")).join("")}</div>`)}</tr>`
        )
        .join("");

  const intentRows = s.intentTypes.length === 0
    ? emptyRow(5)
    : s.intentTypes
        .map(
          (t) => `<tr class="border-t">${td(badge(esc(t.intentType), "violet"), { mono: true })}${td(esc(t.ownerProtocolId), { mono: true, className: "text-muted-foreground" })}${td(mono("v" + esc(t.version)))}${td(esc(t.requiredCapabilityCount), { className: "text-right tabular-nums" })}${td(esc(t.compilerHookCount), { className: "text-right tabular-nums" })}</tr>`
        )
        .join("");

  const wfRows = s.workflows.length === 0
    ? emptyRow(5)
    : s.workflows
        .map(
          (w) => `<tr class="border-t">${td(esc(w.id), { mono: true })}${td(esc(w.name))}${td(esc(w.ownerProtocolId), { mono: true, className: "text-muted-foreground" })}${td(esc(w.stageCount), { className: "text-right tabular-nums" })}${td(`<div class="flex flex-wrap gap-1">${w.triggerIntentTypes.map((t) => badge(esc(t), "info")).join("")}</div>`)}</tr>`
        )
        .join("");

  const polRows = s.policies.length === 0
    ? emptyRow(7)
    : s.policies
        .map(
          (p) => `<tr class="border-t">${td(esc(p.id), { mono: true })}${td(esc(p.name))}${td(esc(p.ownerProtocolId), { mono: true, className: "text-muted-foreground" })}${td(badge(esc(p.scope), "info"))}${td(statusBadge(p.effect))}${td(esc(p.priority), { className: "text-right tabular-nums" })}${td(esc(p.ruleCount), { className: "text-right tabular-nums" })}</tr>`
        )
        .join("");

  const extRows = s.compilerExtensions.length === 0
    ? emptyRow(5)
    : s.compilerExtensions
        .map(
          (x) => `<tr class="border-t">${td(esc(x.name), { mono: true })}${td(esc(x.ownerProtocolId), { mono: true, className: "text-muted-foreground" })}${td(badge(esc(x.phase), "info"))}${td(esc(x.order), { className: "text-right tabular-nums" })}${td(esc(x.insertion), { className: "text-muted-foreground" })}</tr>`
        )
        .join("");

  return `<div class="space-y-4">
    ${sectionTitle("🗂️ Protocol Registries", "5 contribution registries")}
    <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      ${stat("Capabilities", fmtNum(s.capabilities.length))}
      ${stat("Intent Types", fmtNum(s.intentTypes.length))}
      ${stat("Workflows", fmtNum(s.workflows.length))}
      ${stat("Policies", fmtNum(s.policies.length))}
      ${stat("Compiler Extensions", fmtNum(s.compilerExtensions.length))}
    </div>
    ${card({
      title: "Capabilities",
      subtitle: "Capability registry — protocol-contributed execution units",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("ID")}${th("Type")}${th("Owner")}${th("Version")}${th("In", "text-right")}${th("Out", "text-right")}${th("Tags")}</tr></thead><tbody>${capRows}</tbody>`),
    })}
    ${card({
      title: "Intent Types",
      subtitle: "Intent type registry — declarative work descriptions",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Intent Type")}${th("Owner")}${th("Version")}${th("Required Caps", "text-right")}${th("Compiler Hooks", "text-right")}</tr></thead><tbody>${intentRows}</tbody>`),
    })}
    ${card({
      title: "Workflows",
      subtitle: "Workflow registry — BPMN-like stage sequences",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("ID")}${th("Name")}${th("Owner")}${th("Stages", "text-right")}${th("Triggers")}</tr></thead><tbody>${wfRows}</tbody>`),
    })}
    ${card({
      title: "Policies",
      subtitle: "Policy registry — rule bundles with scope &amp; effect",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("ID")}${th("Name")}${th("Owner")}${th("Scope")}${th("Effect")}${th("Priority", "text-right")}${th("Rules", "text-right")}</tr></thead><tbody>${polRows}</tbody>`),
    })}
    ${card({
      title: "Compiler Extensions",
      subtitle: "Protocol-contributed compiler stage insertions",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Name")}${th("Owner")}${th("Phase")}${th("Order", "text-right")}${th("Insertion")}</tr></thead><tbody>${extRows}</tbody>`),
    })}
  </div>`;
}

// ── 9. Exchange (Coordination) ─────────────────────────────────────────────

function renderExchange(d: KernelDemoResult): string {
  const c = d.coordination;

  const stepRows = c.steps
    .map(
      (s, i) => `<tr class="border-t">${td(esc(i + 1), { mono: true, className: "text-muted-foreground" })}${td(badge(esc(s.step), "info"))}${td(esc(s.detail), { mono: true, className: "text-muted-foreground" })}${td(s.ok ? badge("✓ ok", "success") : badge("✗ failed", "error"))}</tr>`
    )
    .join("");

  const engineCards = COORDINATION_ENGINES
    .map(
      (e, i) => `<div class="rounded-md border bg-background p-3 space-y-1"><div class="flex items-center justify-between"><span class="text-xs font-medium">${i + 1}. ${esc(e.name)}</span>${badge("engine", "violet")}</div><p class="text-[11px] text-muted-foreground">${esc(e.role)}</p></div>`
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("🔀 Coordination Exchange", "Coordination spine — 8 engines")}
    ${card({
      title: "Outcome",
      subtitle: "Coordination transaction result",
      action: statusBadge(c.outcome),
      body: `<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        ${stat("Candidates", fmtNum(c.candidateCount))}
        ${stat("Match Score", esc(c.matchScore ?? "—"))}
        ${stat("Match Resource", `<span class="text-sm font-mono">${esc(c.matchResourceId ?? "—")}</span>`)}
        ${stat("Assignment Status", statusBadge(c.assignmentStatus ?? "—"))}
      </div>`,
    })}
    ${card({
      title: "Step Trace",
      subtitle: "Coordination spine execution",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("#")}${th("Step")}${th("Detail")}${th("Result")}</tr></thead><tbody>${stepRows}</tbody>`),
    })}
    ${card({
      title: "Artifacts",
      subtitle: "Identifiers produced by the coordination spine",
      body: `<div class="grid gap-2 sm:grid-cols-2">
        ${kv("Match Resource ID", mono(esc(c.matchResourceId ?? "—")), true)}
        ${kv("Match Score", mono(esc(c.matchScore ?? "—")), true)}
        ${kv("Reservation ID", mono(esc(c.reservationId ?? "—")), true)}
        ${kv("Commitment ID", mono(esc(c.commitmentId ?? "—")), true)}
        ${kv("Assignment ID", mono(esc(c.assignmentId ?? "—")), true)}
        ${kv("Assignment Status", statusBadge(c.assignmentStatus ?? "—"))}
      </div>`,
    })}
    ${card({
      title: "Coordination Engines",
      subtitle: "The 8 engines of the coordination kernel (ADR-0015)",
      body: `<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">${engineCards}</div>`,
    })}
  </div>`;
}

// ── 10. Resources ──────────────────────────────────────────────────────────

function renderResources(d: KernelDemoResult): string {
  const r = d.resourceKernel;

  const findCapAction = r.capableResults.length > 0
    ? badge(`${r.capableResults.length} matches`, "success")
    : badge("no matches", "warning");

  const resCards = r.resources
    .map(
      (res) => {
        const extras: string[] = [];
        if (res.matchScore !== undefined) extras.push(badge("match: " + esc(res.matchScore), "info"));
        if (res.certified !== undefined) extras.push(badge(res.certified ? "certified" : "uncertified", res.certified ? "success" : "neutral"));
        if (res.confidence !== undefined) extras.push(badge("confidence: " + esc(fmtPct(res.confidence)), "violet"));
        const extraHtml = extras.length > 0 ? `<div class="flex flex-wrap gap-1.5 pt-2 border-t">${extras.join("")}</div>` : "";
        return card({
          title: esc(res.displayName),
          subtitle: esc(res.id),
          action: `<div class="flex items-center gap-2">${badge(esc(res.resourceType), "info")}${statusBadge(res.operationalState)}</div>`,
          body: `
            <div class="grid gap-2 sm:grid-cols-2">
              ${kv("Health Score", `<span class="tabular-nums">${esc(fmtPct(res.healthScore))}</span>`)}
              ${kv("Reliability", `<span class="tabular-nums">${esc(fmtPct(res.reliabilityScore))}</span>`)}
              ${kv("Capacity", `<span class="tabular-nums">${res.capacityRemaining}/${res.capacityMax}</span>`)}
              ${kv("Certifications", esc(res.certificationCount))}
              ${kv("Location", esc(res.location ?? "—"))}
              ${kv("Twin Updated", mono(esc(fmtTime(res.twinUpdatedAt))), true)}
            </div>
            ${extraHtml}`,
        });
      }
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("🗃️ Resource Registry", `${r.resources.length} resources registered`)}
    ${card({
      title: "findCapable Query",
      subtitle: "Coordination → resource kernel lookup",
      action: findCapAction,
      body: `
        ${kv("Capability Type", mono(esc(r.queryCapabilityType)), true)}
        ${kv("Matched Resources", esc(r.capableResults.length))}
        <p class="text-xs text-muted-foreground pt-1">The coordination kernel queries the resource kernel for capable resources during the matching engine step.</p>`,
    })}
    <div class="grid gap-3 md:grid-cols-2">${resCards}</div>
  </div>`;
}

// ── 11. Knowledge ──────────────────────────────────────────────────────────

function renderKnowledge(d: KernelDemoResult): string {
  const k = d.knowledgeKernel;
  const q = k.query;

  const itemRows = k.items
    .map(
      (it) => `<tr class="border-t">${td(esc(it.id), { mono: true, className: "text-muted-foreground" })}${td(badge(esc(it.kind), "violet"))}${td(esc(it.title))}${td("v" + esc(it.version), { className: "tabular-nums" })}${td(statusBadge(it.status))}${td(esc(fmtPct(it.confidence)), { className: "text-right tabular-nums" })}${td(esc(it.evidenceCount), { className: "text-right tabular-nums" })}${td(esc(it.ownerProtocolId ?? "kernel"), { mono: true, className: "text-muted-foreground" })}</tr>`
    )
    .join("");

  const registryCards = KNOWLEDGE_REGISTRIES
    .map((r, i) => `<div class="rounded-md border bg-background p-2.5 flex items-center gap-2"><span class="font-mono text-[10px] text-muted-foreground">${(i + 1).toString().padStart(2, "0")}</span><span class="text-xs font-medium">${esc(r)}</span></div>`)
    .join("");

  const complianceAction = q.complianceCompliant
    ? badge("✓ COMPLIANT", "success")
    : badge(`✗ ${q.complianceViolations} VIOLATIONS`, "error");

  return `<div class="space-y-4">
    ${sectionTitle("📚 Knowledge Explorer", `${k.items.length} knowledge items`)}
    ${card({
      title: "Lookup Query",
      subtitle: "Subject-specific knowledge resolution",
      action: complianceAction,
      body: `
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${stat("Subject", `<span class="text-sm">${esc(q.subjectKind)}</span>`)}
          ${stat("Subject ID", `<span class="text-sm font-mono">${esc(q.subjectId)}</span>`)}
          ${stat("Matched Items", fmtNum(q.matchedItems))}
          ${stat("Violations", fmtNum(q.complianceViolations), undefined, q.complianceViolations > 0 ? "error" : "success")}
        </div>
        <div class="grid gap-2 grid-cols-2 sm:grid-cols-4 pt-2 border-t">
          ${kv("Procedures", esc(q.matchedProcedures))}
          ${kv("Regulations", esc(q.matchedRegulations))}
          ${kv("Facts", esc(q.matchedFacts))}
          ${kv("Compliant", q.complianceCompliant ? "yes" : "no")}
        </div>`,
    })}
    ${card({
      title: "Knowledge Items",
      subtitle: "Items owned by the kernel (ADR-0017)",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("ID")}${th("Kind")}${th("Title")}${th("Version")}${th("Status")}${th("Confidence", "text-right")}${th("Evidence", "text-right")}${th("Owner")}</tr></thead><tbody>${itemRows}</tbody>`),
    })}
    ${card({
      title: "14 Knowledge Registries",
      subtitle: "Universal operational knowledge categories",
      body: `<div class="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">${registryCards}</div>`,
    })}
  </div>`;
}

// ── 12. Domains ────────────────────────────────────────────────────────────

function renderDomains(d: KernelDemoResult): string {
  const dm = d.domainModeling;

  const entityRows = dm.entityTypes
    .map(
      (e) => `<tr class="border-t">${td(esc(e.id), { mono: true })}${td(esc(e.name))}${td(esc(e.attributeCount), { className: "text-right tabular-nums" })}${td(esc(e.relationshipCount), { className: "text-right tabular-nums" })}${td(e.twinEnabled ? badge("enabled", "success") : badge("off", "neutral"))}${td(e.hasStateMachine ? badge("yes", "violet") : badge("no", "neutral"))}</tr>`
    )
    .join("");

  const relRows = dm.relationships.length === 0
    ? emptyRow(6)
    : dm.relationships
        .map(
          (r) => `<tr class="border-t">${td(esc(r.id), { mono: true })}${td(esc(r.name))}${td(badge(esc(r.kind), "info"))}${td(esc(r.source), { mono: true })}${td(esc(r.target), { mono: true })}${td(badge(esc(r.cardinality), "neutral"))}</tr>`
        )
        .join("");

  const layering = `<div class="flex flex-wrap items-center gap-2 text-xs">
    ${badge("shared-kernel", "neutral")}<span class="text-muted-foreground">→</span>
    ${badge("knowledge-kernel", "info")}<span class="text-muted-foreground">→</span>
    ${badge("domain-modeling", "violet")}<span class="text-muted-foreground">→</span>
    ${badge("protocol-sdk", "info")}<span class="text-muted-foreground">→</span>
    ${badge("application-runtime", "neutral")}
  </div>`;

  return `<div class="space-y-4">
    ${sectionTitle("🧩 Domain Explorer", "Semantic layer — Domain ≠ Protocol (ADR-0018)")}
    ${card({
      title: esc(dm.domainName),
      subtitle: esc(dm.domainId),
      action: badge(mono("v" + esc(dm.version)), "violet"),
      body: `<div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        ${stat("Entity Types", fmtNum(dm.entityTypeCount))}
        ${stat("Relationships", fmtNum(dm.relationshipCount))}
        ${stat("State Machines", fmtNum(dm.stateMachineCount))}
        ${stat("Measurements", fmtNum(dm.measurementCount))}
        ${stat("Constraints", fmtNum(dm.constraintCount))}
        ${stat("Domain ID", `<span class="text-xs font-mono">${esc(dm.domainId)}</span>`)}
      </div>`,
    })}
    ${card({
      title: "Entity Types",
      subtitle: "First-class semantic entities",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("ID")}${th("Name")}${th("Attributes", "text-right")}${th("Relationships", "text-right")}${th("Twin")}${th("State Machine")}</tr></thead><tbody>${entityRows}</tbody>`),
    })}
    ${card({
      title: "Relationship Graph",
      subtitle: "Semantic connections between entity types",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("ID")}${th("Name")}${th("Kind")}${th("Source")}${th("Target")}${th("Cardinality")}</tr></thead><tbody>${relRows}</tbody>`),
    })}
    ${card({ title: "Layering", subtitle: "Domain modeling sits above knowledge-kernel, below protocols", body: layering })}
  </div>`;
}

// ── 13. Packages ───────────────────────────────────────────────────────────

function renderPackages(d: KernelDemoResult): string {
  const c = d.composition;

  const pipeline = c.stages
    .map((s, i) => {
      const cls = s.ok
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";
      const arrow = i < c.stages.length - 1 ? `<span class="text-muted-foreground">→</span>` : "";
      return `<div class="flex items-center gap-2"><div class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${cls}"><span class="font-mono text-[10px] text-muted-foreground">${i + 1}</span><span class="font-medium">${esc(s.stage)}</span><span>${s.ok ? "✓" : "✗"}</span></div>${arrow}</div>`;
    })
    .join("");

  const lifecycleRows = c.lifecycleEvents.length === 0
    ? emptyRow(3, "No lifecycle transitions recorded")
    : c.lifecycleEvents
        .map((e, i) => `<tr class="border-t">${td(esc(i + 1), { mono: true, className: "text-muted-foreground" })}${td(statusBadge(e.from))}${td("→ " + statusBadge(e.to))}</tr>`)
        .join("");

  const contentRows = c.contentCounts
    .map((cc) => `<tr class="border-t">${td(badge(esc(cc.kind), "info"))}${td(esc(cc.count), { className: "text-right tabular-nums font-mono" })}</tr>`)
    .join("");

  const layering = `<div class="flex flex-wrap items-center gap-2 text-xs">
    ${badge("shared-kernel", "neutral")}<span class="text-muted-foreground">→</span>
    ${badge("protocol-sdk", "info")}<span class="text-muted-foreground">+</span>
    ${badge("domain-modeling", "info")}<span class="text-muted-foreground">→</span>
    ${badge("composition", "violet")}<span class="text-muted-foreground">→</span>
    ${badge(".opspkg artifact", "neutral")}<span class="text-muted-foreground">→</span>
    ${badge("application install", "neutral")}
  </div>`;

  return `<div class="space-y-4">
    ${sectionTitle("📦 Operational Package", "Immutable .opspkg artifacts (ADR-0019)")}
    ${card({
      title: esc(c.packageId),
      subtitle: `Operational package · v${esc(c.version)}`,
      action: `<div class="flex flex-wrap gap-1.5">
        ${badge(c.compiled ? "✓ COMPILED" : "✗ COMPILE FAIL", c.compiled ? "success" : "error")}
        ${badge(c.signed ? "✓ SIGNED" : "✗ UNSIGNED", c.signed ? "success" : "error")}
        ${badge(c.installed ? "✓ INSTALLED" : "✗ NOT INSTALLED", c.installed ? "success" : "error")}
        ${badge(c.activated ? "✓ ACTIVATED" : "✗ INACTIVE", c.activated ? "success" : "error")}
      </div>`,
      body: `<div class="grid gap-3 sm:grid-cols-3">
        ${stat("Package ID", `<span class="text-xs font-mono">${esc(c.packageId)}</span>`)}
        ${stat("Version", mono("v" + esc(c.version)))}
        ${stat("Digest", mono(esc(c.digest)))}
      </div>`,
    })}
    <button onclick="compilePackage()" class="px-4 py-2 rounded-md text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors">▶ Compile & Install Package</button>
    ${card({
      title: "Composition Pipeline",
      subtitle: "6-stage pipeline turning protocol source into an immutable artifact",
      body: `<div class="flex flex-wrap items-center gap-2">${pipeline}</div>`,
    })}
    <div class="grid gap-4 lg:grid-cols-2">
      ${card({
        title: "Lifecycle Events",
        subtitle: "Package state transitions",
        body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("#")}${th("From")}${th("To")}</tr></thead><tbody>${lifecycleRows}</tbody>`),
      })}
      ${card({
        title: "Contents",
        subtitle: "What's bundled in the .opspkg",
        body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Kind")}${th("Count", "text-right")}</tr></thead><tbody>${contentRows}</tbody>`),
      })}
    </div>
    ${card({ title: "Layering", subtitle: "Composition sits above protocol-sdk &amp; domain-modeling", body: layering })}
  </div>`;
}

// ── 14. Simulation ─────────────────────────────────────────────────────────

function renderSimulation(d: KernelDemoResult): string {
  const c = d.conformance;

  const categoryCards = SIMULATION_CATEGORIES
    .map(
      (cat) => `<div class="rounded-md border bg-background p-3 space-y-1"><div class="flex items-center justify-between"><span class="text-xs font-medium">${esc(cat.name)}</span>${badge(`${cat.count} passed`, "success")}</div></div>`
    )
    .join("");

  const scenarioRows = c.scenarios
    .map(
      (s, i) => `<tr class="border-t">${td((i + 1).toString().padStart(2, "0"), { mono: true, className: "text-muted-foreground" })}${td(esc(s.id), { mono: true })}${td(esc(s.name.trim()))}${td(badge(esc(s.category), "info"))}${td(s.passed ? badge("✓ pass", "success") : badge("✗ fail", "error"))}${td(`${s.assertionsPassed}/${s.assertionsTotal}`, { className: "text-right tabular-nums" })}${td(esc(s.eventCount), { className: "text-right tabular-nums" })}${td(`${s.durationMs}ms`, { className: "text-right tabular-nums" })}${td(s.replayVerified ? badge("✓", "success") : badge("✗", "error"))}</tr>`
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("🧪 Conformance Suite", "Kernel Conformance &amp; Simulation Framework (ADR-0020)")}
    ${card({
      title: "Suite Result",
      subtitle: `${c.totalScenarios} generic scenarios validating kernel neutrality`,
      action: c.failed === 0 ? badge("✓ ALL SCENARIOS PASS", "success") : badge(`✗ ${c.failed} FAILING`, "error"),
      body: `
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${stat("Total Scenarios", fmtNum(c.totalScenarios))}
          ${stat("Passed", fmtNum(c.passed), undefined, "success")}
          ${stat("Failed", fmtNum(c.failed), undefined, c.failed > 0 ? "error" : "success")}
          ${stat("Replay Verified", c.replayVerified ? "yes" : "no", undefined, c.replayVerified ? "success" : "error")}
        </div>
        <div class="grid gap-2 sm:grid-cols-2 pt-2 border-t">
          ${kv("Deterministic Checksum", mono(esc(c.deterministicChecksum)), true)}
          ${kv("Pass Rate", `<span class="tabular-nums">${esc(fmtPct(c.passed / c.totalScenarios))}</span>`)}
        </div>`,
    })}
    <button onclick="runConformance()" class="px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">▶ Run Conformance Suite</button>
    ${card({
      title: "Validation Categories",
      subtitle: "Coverage across the kernel surface",
      body: `<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${categoryCards}</div>`,
    })}
    ${card({
      title: "Scenario Results",
      subtitle: "All 25 scenarios with assertion counts",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("#")}${th("ID")}${th("Name")}${th("Category")}${th("Result")}${th("Assertions", "text-right")}${th("Events", "text-right")}${th("Duration", "text-right")}${th("Replay")}</tr></thead><tbody>${scenarioRows}</tbody>`),
    })}
  </div>`;
}

// ── 15. Intelligence ───────────────────────────────────────────────────────

function renderIntelligence(d: KernelDemoResult): string {
  const i = d.intelligence;

  const recRows = i.recommendations.length === 0
    ? emptyRow(4, "No recommendations")
    : i.recommendations
        .map(
          (r) => `<tr class="border-t">${td(badge(esc(r.category), "info"))}${td(esc(r.action))}${td(esc(fmtPct(r.confidence)), { className: "text-right tabular-nums" })}${td(badge(esc(r.impact), r.impact === "low" ? "neutral" : r.impact === "high" ? "warning" : "info"))}</tr>`
        )
        .join("");

  const predRows = i.predictions.length === 0
    ? emptyRow(4, "No predictions")
    : i.predictions
        .map(
          (p) => `<tr class="border-t">${td(esc(p.metric), { mono: true })}${td(esc(typeof p.value === "number" ? p.value.toFixed(3) : String(p.value)), { className: "text-right tabular-nums" })}${td(esc(fmtPct(p.confidence)), { className: "text-right tabular-nums" })}${td(esc(p.method), { mono: true, className: "text-muted-foreground" })}</tr>`
        )
    .join("");

  const anomaliesBody = i.anomalies.length === 0
    ? `<div class="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">✓ No anomalies detected — operational baseline is nominal.</div>`
    : tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Kind")}${th("Severity")}${th("Description")}</tr></thead><tbody>${i.anomalies.map((a) => `<tr class="border-t">${td(badge(esc(a.kind), "info"))}${td(badge(esc(a.severity), severityTone(a.severity)))}${td(esc(a.description), { className: "text-muted-foreground" })}</tr>`).join("")}</tbody>`);

  const contractCards = i.aiContracts
    .map((c) => `<div class="rounded-md border bg-background p-2.5 flex items-center gap-2"><span class="text-violet-600 dark:text-violet-400">◇</span><span class="text-xs font-medium font-mono">${esc(c)}</span></div>`)
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("🧠 Operational Intelligence", "Observes, explains, predicts, recommends — never performs work (ADR-0021)")}
    ${card({
      title: "Knowledge Graph Stats",
      subtitle: "Observed entity &amp; relationship graph",
      body: `<div class="grid gap-3 sm:grid-cols-3">
        ${stat("Graph Nodes", fmtNum(i.graphNodeCount))}
        ${stat("Graph Edges", fmtNum(i.graphEdgeCount))}
        ${stat("Learning Signals", fmtNum(i.learningSignals))}
      </div>`,
    })}
    ${card({
      title: "Explanation",
      subtitle: `Kind: ${esc(i.explanation.kind)}`,
      action: badge("confidence " + esc(fmtPct(i.explanation.confidence)), "violet"),
      body: `
        <p class="text-sm text-foreground">${esc(i.explanation.rationale)}</p>
        <div class="grid gap-2 sm:grid-cols-2 pt-2 border-t">
          ${kv("Evidence Count", esc(i.explanation.evidenceCount))}
          ${kv("Alternative Count", esc(i.explanation.alternativeCount))}
        </div>`,
    })}
    ${card({
      title: "Recommendations",
      subtitle: "Suggested actions (never auto-executed)",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Category")}${th("Action")}${th("Confidence", "text-right")}${th("Impact")}</tr></thead><tbody>${recRows}</tbody>`),
    })}
    ${card({
      title: "Predictions",
      subtitle: "Forecasted metric values",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Metric")}${th("Value", "text-right")}${th("Confidence", "text-right")}${th("Method")}</tr></thead><tbody>${predRows}</tbody>`),
    })}
    ${card({ title: "Anomalies", subtitle: "Detected deviations from baseline", body: anomaliesBody })}
    ${card({
      title: "AI Contracts",
      subtitle: "Contracts AI providers must implement",
      body: `<div class="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">${contractCards}</div>`,
    })}
  </div>`;
}

// ── 16. Governance ─────────────────────────────────────────────────────────

function renderGovernance(d: KernelDemoResult): string {
  const g = d.governance;

  const versionRows = g.versions
    .map(
      (v) => `<tr class="border-t">${td(esc(v.id), { mono: true })}${td(badge(esc(v.kind), "info"))}${td(mono("v" + esc(v.version)))}${td(statusBadge(v.lifecycle))}</tr>`
    )
    .join("");

  const compatRows = g.compatibilityResults
    .map(
      (r) => `<tr class="border-t">${td(badge(esc(r.dimension), "violet"), { mono: true })}${td(r.compatible ? badge("✓ compatible", "success") : badge("✗ incompatible", "error"))}${td(esc(r.details), { mono: true, className: "text-muted-foreground" })}</tr>`
    )
    .join("");

  const certRows = g.certifications.length === 0
    ? emptyRow(3, "No certifications")
    : g.certifications
        .map((c) => `<tr class="border-t">${td(badge(esc(c.kind), "info"))}${td(esc(c.subjectId), { mono: true, className: "text-muted-foreground" })}${td(statusBadge(c.status))}</tr>`)
        .join("");

  const migrationBody = g.migrationPlan
    ? `<div class="space-y-2">
        <div class="flex items-center gap-2 text-xs">
          ${badge(esc(g.migrationPlan.type), "info")}
          <span class="text-muted-foreground">From</span>
          ${mono("v" + esc(g.migrationPlan.from))}
          <span class="text-muted-foreground">→</span>
          ${mono("v" + esc(g.migrationPlan.to))}
        </div>
        ${kv("Step Count", esc(g.migrationPlan.stepCount))}
        ${kv("Dry Run", g.migrationPlan.dryRunOk ? badge("✓ ok", "success") : badge("✗ failed", "error"))}
      </div>`
    : `<p class="text-xs text-muted-foreground">No migration plan active.</p>`;

  const policyRows = g.policies
    .map((p) => `<tr class="border-t">${td(badge(esc(p.kind), "violet"), { mono: true })}${td(statusBadge(p.enforcement))}</tr>`)
    .join("");

  const lifecycleFlow = g.lifecycleStates
    .map(
      (s, idx) => `<div class="flex items-center gap-1">${badge(esc(s), statusTone(s))}${idx < g.lifecycleStates.length - 1 ? `<span class="text-muted-foreground text-xs">→</span>` : ""}</div>`
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("⚖️ Platform Governance", "Platform Governance &amp; Evolution (ADR-0022)")}
    <div class="flex flex-wrap gap-2">
      <button onclick="checkGovernance()" class="px-3 py-1.5 rounded-md text-xs font-medium border border-blue-500/30 text-blue-700 hover:bg-blue-500/10 transition-colors">Check Compatibility</button>
      <button onclick="planMigration('1.0.0','1.2.0')" class="px-3 py-1.5 rounded-md text-xs font-medium border border-purple-500/30 text-purple-700 hover:bg-purple-500/10 transition-colors">Plan Migration 1.0.0→1.2.0</button>
      <button onclick="validateEcosystem()" class="px-3 py-1.5 rounded-md text-xs font-medium border border-green-500/30 text-green-700 hover:bg-green-500/10 transition-colors">Validate Ecosystem Package</button>
    </div>
    ${card({
      title: "Versions",
      subtitle: "Versioned artifacts under governance",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("ID")}${th("Kind")}${th("Version")}${th("Lifecycle")}</tr></thead><tbody>${versionRows}</tbody>`),
    })}
    ${card({
      title: "Compatibility Matrix",
      subtitle: "Cross-dimensional version compatibility",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Dimension")}${th("Compatible")}${th("Details")}</tr></thead><tbody>${compatRows}</tbody>`),
    })}
    <div class="grid gap-4 lg:grid-cols-2">
      ${card({
        title: "Certifications",
        subtitle: "Subject certification status",
        body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Kind")}${th("Subject")}${th("Status")}</tr></thead><tbody>${certRows}</tbody>`),
      })}
      ${card({
        title: "Migration Plan",
        subtitle: g.migrationPlan ? `${esc(g.migrationPlan.type)} · ${g.migrationPlan.stepCount} steps` : "No active migration",
        body: migrationBody,
      })}
    </div>
    ${card({
      title: "Governance Policies",
      subtitle: "Evolution enforcement rules",
      body: tableWrap(`<thead class="bg-muted/50 sticky top-0"><tr>${th("Kind")}${th("Enforcement")}</tr></thead><tbody>${policyRows}</tbody>`),
    })}
    ${card({
      title: "Lifecycle States",
      subtitle: "Allowed lifecycle states for governed artifacts",
      body: `<div class="flex flex-wrap gap-2">${lifecycleFlow}</div>`,
    })}
  </div>`;
}

// ── 17. Platform ───────────────────────────────────────────────────────────

function renderPlatform(d: KernelDemoResult): string {
  const p = d.platform;

  type DataMap = Record<string, number | string>;
  const sections: { title: string; icon: string; milestone: string; data: DataMap; fields: [string, string][] }[] = [
    { title: "AI Workforce", icon: "🤖", milestone: "M14", data: p.aiWorkforce as DataMap, fields: [["Agents", "agentCount"], ["Teams", "teamCount"], ["Roles", "roleCount"], ["Pending Approvals", "pendingApprovals"], ["Handoffs", "handoffs"], ["Memories", "memories"]] },
    { title: "Communication", icon: "📨", milestone: "M15", data: p.communication as DataMap, fields: [["Channels", "channelCount"], ["Templates", "templateCount"], ["Recipients", "recipientCount"], ["Dispatched", "notificationsDispatched"], ["Suppressed", "suppressedChannels"]] },
    { title: "Workflow Runtime", icon: "🔁", milestone: "M16", data: p.workflow as DataMap, fields: [["Definitions", "definitionCount"], ["Instances", "instanceCount"], ["Active", "activeInstances"], ["Completed", "completedInstances"], ["Timers", "timersScheduled"], ["Recurring Jobs", "recurringJobs"]] },
    { title: "Integration Hub", icon: "🔌", milestone: "M17", data: p.integration as DataMap, fields: [["Connectors", "connectorCount"], ["Capabilities", "capabilityCount"], ["Webhook Endpoints", "webhookEndpoints"], ["Sync Jobs", "syncJobs"], ["Payment Provider", "paymentProvider"]] },
    { title: "Twin Runtime", icon: "🪞", milestone: "M18", data: p.twinRuntime as DataMap, fields: [["Twins", "twinCount"], ["Telemetry Readings", "telemetryReadings"], ["Predictions", "predictions"], ["Simulations", "simulations"], ["Recommendations", "recommendations"], ["Health Issues", "healthIssues"]] },
    { title: "Experience", icon: "🎭", milestone: "M19", data: p.experience as DataMap, fields: [["Sessions", "sessionCount"], ["Journeys", "journeyCount"], ["Intents", "intentCount"], ["Milestones", "milestonesTracked"], ["Goals", "goals"], ["Guidance Generated", "guidanceGenerated"]] },
  ];

  const cards = sections
    .map(
      (s) => {
        const kvs = s.fields.map(([label, key]) => kv(label, `<span class="tabular-nums font-mono">${esc(s.data[key] ?? "—")}</span>`)).join("");
        return card({
          title: `${s.icon} ${esc(s.title)}`,
          subtitle: `Cross-cutting runtime · ${s.milestone}`,
          action: badge(esc(s.milestone), "violet"),
          body: `<div class="space-y-1">${kvs}</div>`,
        });
      }
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("🌐 Cross-cutting Capabilities", "6 cross-cutting platform runtimes (M14–M19)")}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">${cards}</div>
  </div>`;
}

// ── 18. Observability ──────────────────────────────────────────────────────

function renderObservability(d: KernelDemoResult): string {
  const o = d.platformSnapshot.observability;
  const dec = d.decision;

  const matchedRules = dec.matchedRules.length > 0 ? dec.matchedRules.join(", ") : "—";

  const latestDecision = `<div class="rounded-md border bg-background p-3 space-y-2">
    <div class="flex items-center gap-2">
      ${badge("decision", "violet")}
      ${mono(esc(dec.decisionId))}
      <span class="ml-auto">${statusBadge(dec.outcome)}</span>
    </div>
    <div class="grid gap-2 sm:grid-cols-3 text-xs">
      <div>
        <div class="text-[10px] uppercase text-muted-foreground">Evaluated</div>
        ${mono(esc(fmtTime(dec.evaluatedAt)))}
      </div>
      <div>
        <div class="text-[10px] uppercase text-muted-foreground">Input Hash</div>
        ${mono(esc(dec.inputHash ?? "—"))}
      </div>
      <div>
        <div class="text-[10px] uppercase text-muted-foreground">Source Events</div>
        <span class="tabular-nums">${esc(dec.sourceEventCount)}</span>
      </div>
    </div>
    <div>
      <div class="text-[10px] uppercase text-muted-foreground mb-1">Matched Rules</div>
      <div class="flex flex-wrap gap-1">
        ${dec.matchedRules.length === 0 ? `<span class="text-xs text-muted-foreground">—</span>` : dec.matchedRules.map((r) => badge(mono(esc(r)), "info")).join("")}
      </div>
    </div>
  </div>`;

  return `<div class="space-y-4">
    ${sectionTitle("👁️ Observability", "Tracer, Meter, Logger, AuditSink, ProvenanceRecorder")}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      ${stat("Events Recorded", fmtNum(o.eventCount))}
      ${stat("Spans", fmtNum(o.spanCount))}
      ${stat("Decisions Tracked", fmtNum(o.decisions.length))}
      ${stat("Audit Events", fmtNum(o.auditEvents.length))}
    </div>
    ${card({
      title: "Decision Provenance",
      subtitle: "Policy decision with full audit trail",
      action: statusBadge(dec.outcome),
      body: `
        <div class="space-y-1">
          ${kv("Decision ID", mono(esc(dec.decisionId)), true)}
          ${kv("Outcome", statusBadge(dec.outcome))}
          ${kv("Evaluated At", mono(esc(fmtTime(dec.evaluatedAt))), true)}
          ${kv("Input Hash", mono(esc(dec.inputHash ?? "—")), true)}
          ${kv("Source Events", esc(dec.sourceEventCount))}
          ${kv("Matched Rules", `<span class="font-mono text-xs">${esc(matchedRules)}</span>`)}
        </div>
        <div class="pt-2 border-t">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Rationale</div>
          <p class="text-xs text-foreground">${esc(dec.rationale)}</p>
        </div>`,
    })}
    ${card({ title: "Latest Policy Decision", subtitle: "Decision provenance chain", body: latestDecision })}
    ${card({
      title: "Observability Signals",
      subtitle: "Snapshot of meter &amp; audit counts",
      body: `<div class="grid gap-2 sm:grid-cols-2">
        ${kv("Metric Points", esc(o.metricPoints.length))}
        ${kv("Audit Events", esc(o.auditEvents.length))}
        ${kv("Decisions", esc(o.decisions.length))}
        ${kv("Spans", esc(o.spanCount))}
      </div>`,
    })}
  </div>`;
}

// ── 19. Architecture ───────────────────────────────────────────────────────

function renderArchitecture(d: KernelDemoResult): string {
  const modules = d.modules;
  const primitives = d.primitives;

  const invariantCards = ARCHITECTURE_INVARIANTS
    .map((inv, i) => `<div class="flex items-start gap-2 rounded-md border bg-background p-2.5"><span class="font-mono text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">${(i + 1).toString().padStart(2, "0")}</span><span class="text-xs">${esc(inv)}</span></div>`)
    .join("");

  const primitiveCards = primitives
    .map(
      (p, i) => `<div class="rounded-md border bg-background p-2.5 space-y-1"><div class="flex items-center justify-between"><span class="text-xs font-mono font-semibold">${esc(p.name)}</span><span class="font-mono text-[10px] text-muted-foreground">${(i + 1).toString().padStart(2, "0")}</span></div><div class="text-[10px] text-muted-foreground">owner: ${mono(esc(p.owner))}</div></div>`
    )
    .join("");

  const moduleCards = modules
    .map(
      (m, i) => `<div class="rounded-lg border bg-background p-3 space-y-2"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2 min-w-0"><span class="font-mono text-[10px] text-muted-foreground">${(i + 1).toString().padStart(2, "0")}</span><span class="font-mono text-xs font-semibold truncate">${esc(m.name)}</span></div>${badge(esc(m.layer), "info")}</div><p class="text-[11px] text-muted-foreground leading-snug">${esc(m.description)}</p><div class="pt-1 border-t"><div class="text-[10px] uppercase tracking-wide text-muted-foreground">Depends on</div><div class="font-mono text-[10px] text-muted-foreground break-words">${esc(m.dependsOn)}</div></div></div>`
    )
    .join("");

  return `<div class="space-y-4">
    ${sectionTitle("🏛️ Kernel Architecture", `${modules.length} modules · ${primitives.length} canonical primitives · 10 invariants`)}
    ${card({
      title: "Architecture Invariants",
      subtitle: "10 inviolable rules governing the kernel",
      body: `<div class="grid gap-2 sm:grid-cols-2">${invariantCards}</div>`,
    })}
    ${card({
      title: "Canonical Primitives",
      subtitle: "The 19 frozen v1 primitives — owned by runtime/policy/events/etc.",
      body: `<div class="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">${primitiveCards}</div>`,
    })}
    ${card({
      title: "Module Cards",
      subtitle: `${modules.length} kernel modules across all layers`,
      body: `<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">${moduleCards}</div>`,
    })}
  </div>`;
}

// ── Tab renderer registry ──────────────────────────────────────────────────

const TAB_RENDERERS: Record<string, (d: KernelDemoResult) => string> = {
  overview: renderOverview,
  protocols: renderProtocols,
  applications: renderApplications,
  organizations: renderOrganizations,
  compiler: renderCompiler,
  events: renderEvents,
  projections: renderProjections,
  registries: renderRegistries,
  exchange: renderExchange,
  resources: renderResources,
  knowledge: renderKnowledge,
  domains: renderDomains,
  packages: renderPackages,
  simulation: renderSimulation,
  intelligence: renderIntelligence,
  governance: renderGovernance,
  platform: renderPlatform,
  observability: renderObservability,
  architecture: renderArchitecture,
};

// ── Inline CSS for tab buttons ─────────────────────────────────────────────

const TAB_STYLES = `
.tab-btn{display:inline-flex;align-items:center;gap:0.25rem;padding:0.375rem 0.75rem;font-size:0.75rem;font-weight:500;border-radius:0.375rem;border:1px solid transparent;color:var(--muted-foreground);background:transparent;cursor:pointer;white-space:nowrap;transition:background-color 0.15s,color 0.15s,border-color 0.15s;font-family:inherit}
.tab-btn:hover{background:var(--muted);color:var(--foreground)}
.tab-btn-active,.tab-btn-active:hover{background:var(--primary);color:var(--primary-foreground);border-color:var(--primary)}
.tab-panel{animation:tab-fade 0.15s ease-out}
@keyframes tab-fade{from{opacity:0}to{opacity:1}}
`;

// ── Inline script for tab switching ────────────────────────────────────────

const TAB_SCRIPT = `
function switchTab(id){
  document.querySelectorAll('.tab-panel').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => { el.classList.remove('tab-btn-active'); });
  var panel = document.getElementById('tab-' + id);
  if (panel) panel.style.display = 'block';
  var ev = window.event || (arguments.length > 1 ? arguments[1] : null);
  if (ev && ev.currentTarget) {
    ev.currentTarget.classList.add('tab-btn-active');
  } else {
    var btn = document.querySelector('.tab-btn[data-tab="' + id + '"]');
    if (btn) btn.classList.add('tab-btn-active');
  }
}
`;

// ── Action script (API calls + toast) ──────────────────────────────────────

const ACTION_SCRIPT = `
async function apiAction(endpoint, body, successMsg) {
  var toast = document.getElementById('action-toast');
  toast.textContent = 'Processing...';
  toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white shadow-lg transition-opacity';
  toast.style.opacity = '1';
  try {
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    var data = await res.json();
    if (data.ok === false || data.error) {
      toast.textContent = 'Error: ' + (data.error || 'Operation failed');
      toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white shadow-lg';
    } else {
      toast.textContent = successMsg || 'Operation completed';
      toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white shadow-lg';
    }
  } catch (e) {
    toast.textContent = 'Error: ' + e.message;
    toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white shadow-lg';
  }
  setTimeout(function() { toast.style.opacity = '0'; }, 3000);
}

function confirmAction(msg, endpoint, body, successMsg) {
  if (confirm(msg)) {
    apiAction(endpoint, body, successMsg);
  }
}

function protocolAction(action, protocolId) {
  var msgs = {
    validate: ['Validate protocol ' + protocolId + '?', 'Protocol validated'],
    install: ['Install protocol ' + protocolId + '?', 'Protocol installed'],
    enable: ['Enable protocol ' + protocolId + '?', 'Protocol enabled'],
    disable: ['Disable protocol ' + protocolId + '?', 'Protocol disabled'],
    uninstall: ['Uninstall protocol ' + protocolId + '? This cannot be undone.', 'Protocol uninstalled'],
  };
  var m = msgs[action] || [action + '?', 'Done'];
  confirmAction(m[0], '/api/protocols/install', { action: action, protocolId: protocolId }, m[1]);
}

function appAction(action, appId) {
  var msgs = {
    activate: ['Activate application ' + appId + '?', 'Application activated'],
    suspend: ['Suspend application ' + appId + '?', 'Application suspended'],
    archive: ['Archive application ' + appId + '?', 'Application archived'],
    remove: ['Remove application ' + appId + '? This cannot be undone.', 'Application removed'],
  };
  var m = msgs[action] || [action + '?', 'Done'];
  confirmAction(m[0], '/api/applications/install', { action: action, applicationId: appId }, m[1]);
}

function runConformance() {
  apiAction('/api/conformance/run', null, 'Conformance suite completed — check results');
}

function compilePackage() {
  apiAction('/api/packages/compile', null, 'Package compiled and installed');
}

function validateEcosystem() {
  apiAction('/api/ecosystem/validate', {}, 'Ecosystem validation completed');
}

function checkGovernance() {
  apiAction('/api/governance/check', { action: 'check-compatibility' }, 'Compatibility check completed');
}

function planMigration(from, to) {
  apiAction('/api/governance/check', { action: 'plan-migration', fromVersion: from, toVersion: to, type: 'upgrade' }, 'Migration plan created');
}
`;

export default function Home() {
  const d = demoData;

  const navButtons = TABS.map((t, i) => {
    const cls = i === 0 ? "tab-btn tab-btn-active" : "tab-btn";
    return `<button type="button" class="${cls}" data-tab="${t.id}" onclick="switchTab('${t.id}')">${t.icon} ${t.label}</button>`;
  }).join("");

  const panels = TABS.map((t, i) => {
    const renderer = TAB_RENDERERS[t.id];
    const display = i === 0 ? "block" : "none";
    return `<div id="tab-${t.id}" class="tab-panel" style="display:${display}">${renderer(d)}</div>`;
  }).join("\n");

  const html = `<div class="min-h-screen flex flex-col bg-background text-foreground">
  <header class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
    <div class="container mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="size-7 rounded-lg bg-foreground text-background grid place-items-center font-mono font-bold text-xs">K</div>
        <div class="leading-tight">
          <div class="font-semibold text-sm tracking-tight">OpsOS Control Plane</div>
          <div class="text-[10px] text-muted-foreground -mt-0.5">Platform Administration</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium border-indigo-500/30 text-indigo-700">Admin</span>
        <span class="hidden sm:inline-flex items-center rounded-md bg-secondary text-secondary-foreground px-2 py-0.5 text-xs">read-only</span>
      </div>
    </div>
  </header>
  <nav class="sticky top-14 z-30 border-b bg-background/95 backdrop-blur">
    <div class="container mx-auto max-w-7xl px-4">
      <div class="flex items-center gap-1 overflow-x-auto py-1.5" id="tab-nav">${navButtons}</div>
    </div>
  </nav>
  <main class="flex-1 container mx-auto max-w-7xl px-4 py-6 space-y-6">${panels}</main>
  <footer class="mt-auto border-t bg-muted/30">
    <div class="container mx-auto max-w-7xl px-4 py-4 flex items-center justify-between text-[11px] text-muted-foreground">
      <span><span class="font-mono text-foreground">OpsOS</span> Control Plane · Milestones 1–19</span>
      <span class="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono">${d.modules.length} modules · ${d.primitives.length} primitives</span>
    </div>
  </footer>
  <style>${TAB_STYLES}</style>
  <script>${TAB_SCRIPT}</script>
  <script>${ACTION_SCRIPT}</script>
  <div id="action-toast" class="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-opacity" style="opacity:0;pointer-events:none;"></div>
</div>`;

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
