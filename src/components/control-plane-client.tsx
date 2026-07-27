"use client";

/**
 * @src/components/control-plane-client — the Platform Control Plane UI.
 *
 * A client-side tabbed admin console. Receives a pre-computed platform
 * snapshot + demo data from the server component and renders explorer tabs.
 * Read-only by default (ADR-0014). Tab switching is client-side (useState).
 *
 * This is NOT customer-facing. Only platform administrators access it.
 * Applications continue hiding OpsOS completely.
 */

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  Boxes,
  Brain,
  Bug,
  Calendar,
  Component,
  Database,
  Eye,
  GitBranch,
  Globe,
  Grid3x3,
  Heart,
  Layers,
  Network,
  Package,
  Play,
  Settings,
  Shield,
  Workflow,
  Zap,
  ArrowLeftRight,
  MapPin,
  BookOpen,
  Boxes as BoxesIcon,
  Package as PackageIcon,
  FlaskConical,
  Brain as BrainIcon,
  ShieldCheck,
} from "lucide-react";
import type { KernelDemoResult } from "@/lib/kernel-demo";

type TabId =
  | "overview"
  | "protocols"
  | "applications"
  | "organizations"
  | "compiler"
  | "events"
  | "projections"
  | "registries"
  | "exchange"
  | "resources"
  | "knowledge"
  | "domains"
  | "packages"
  | "simulation"
  | "intelligence"
  | "governance"
  | "observability"
  | "architecture";

interface TabDef {
  readonly id: TabId;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly badge?: number;
}

function healthColor(status: string): string {
  if (status === "healthy") return "border-emerald-500/40 text-emerald-700 dark:text-emerald-400";
  if (status === "degraded") return "border-amber-500/40 text-amber-700 dark:text-amber-400";
  return "border-destructive/40 text-destructive";
}

function statusColor(status: string): string {
  if (status === "active" || status === "enabled") return "border-emerald-500/40 text-emerald-700 dark:text-emerald-400";
  if (status === "suspended" || status === "disabled") return "border-amber-500/40 text-amber-700 dark:text-amber-400";
  if (status === "removed" || status === "archived" || status === "uninstalled") return "border-destructive/40 text-destructive";
  return "text-muted-foreground";
}

function layerColor(layer: string): string {
  switch (layer) {
    case "Foundation": return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    case "Engine": return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case "Context": return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
    case "Read side": return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20";
    case "Governance": return "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20";
    case "Host": return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
    case "Compiler": return "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/20";
    case "SDK": return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20";
    case "Runtime": return "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20";
    case "Surface": return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20";
    case "Control": return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
    case "Coordination": return "bg-lime-500/10 text-lime-700 dark:text-lime-400 border-lime-500/20";
    case "Resource": return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20";
    case "Knowledge": return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case "Domain": return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
    case "Packaging": return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
    case "Conformance": return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
    case "Intelligence": return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
    case "Governance": return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

// ── Tab content components ──────────────────────────────────────────────────

function OverviewTab({ demo }: { demo: KernelDemoResult }) {
  const health = demo.platformSnapshot?.health;
  return (
    <div className="space-y-4">
      {/* Health dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="size-4" /> Platform Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Status", value: health?.status ?? "healthy", color: healthColor(health?.status ?? "healthy") },
              { label: "Protocols", value: health?.protocolCount ?? 0 },
              { label: "Applications", value: health?.applicationCount ?? 0 },
              { label: "Active Apps", value: health?.activeApplicationCount ?? 0 },
              { label: "Events", value: health?.eventStorePosition ?? 0 },
              { label: "Compiler Stages", value: health?.compilerStageCount ?? 0 },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border p-3">
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                <div className={`font-mono text-lg font-semibold ${m.color ?? ""}`}>{String(m.value)}</div>
              </div>
            ))}
          </div>
          {health?.checks && (
            <div className="mt-3 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Health checks</div>
              {health.checks.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className={`text-[9px] ${healthColor(c.status)}`}>{c.status}</Badge>
                  <span className="font-mono text-muted-foreground">{c.name}</span>
                  {c.detail && <span className="text-muted-foreground">— {c.detail}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Determinism</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={demo.determinism.identical ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}>
              {demo.determinism.identical ? "✓ replay invariant holds" : "✗ invariant broken"}
            </Badge>
            <p className="text-[11px] text-muted-foreground mt-2">
              Seed {demo.determinism.seed} produces identical UUIDs across runs.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Latest compilation</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={demo.compiler.ok ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}>
              {demo.compiler.ok ? "COMPILED" : "FAILED"}
            </Badge>
            <span className="ml-2 text-xs text-muted-foreground font-mono">{demo.compiler.graphId}</span>
            <p className="text-[11px] text-muted-foreground mt-2">
              {demo.compiler.nodeCount} nodes · {demo.compiler.edgeCount} edges · seed {demo.compiler.seed}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProtocolsTab({ demo }: { demo: KernelDemoResult }) {
  return (
    <div className="space-y-3">
      {demo.protocolSdk.protocols.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm font-medium">{p.id}</div>
                <div className="text-xs text-muted-foreground">{p.displayName} · v{p.version}</div>
              </div>
              <Badge variant="outline" className={statusColor(p.state)}>{p.state}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.contributions.map((c) => (
                <Badge key={c.kind} variant="secondary" className="font-mono text-[10px]">
                  {c.kind} <span className="ml-1 tabular-nums">{c.count}</span>
                </Badge>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground">
              validation: {p.validationErrors} errors, {p.validationWarnings} warnings
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
              <span className="text-muted-foreground">lifecycle:</span>
              {demo.protocolSdk.lifecycleEvents
                .filter((e) => e.protocolId === p.id)
                .map((e, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] py-0">{e.from}→{e.to}</Badge>
                    {i < 3 && <span className="text-muted-foreground">·</span>}
                  </span>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ApplicationsTab({ demo }: { demo: KernelDemoResult }) {
  return (
    <div className="space-y-3">
      {/* Install pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Install pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5">
            {demo.appRuntime.installSteps.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-[10px] font-mono ${s.ok ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}`}>
                  {s.step}
                </Badge>
                {i < demo.appRuntime.installSteps.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      {demo.appRuntime.applications.map((app) => (
        <Card key={app.id}>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg grid place-items-center text-white font-bold text-sm" style={{ backgroundColor: app.theme.primary }}>
                  {app.displayName.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-sm">{app.displayName}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{app.id}</div>
                </div>
              </div>
              <Badge variant="outline" className={statusColor(app.status)}>{app.status}</Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] bg-muted/40 rounded-md px-2.5 py-1.5">
              <span className="text-muted-foreground">protocol:</span>
              <span className="font-mono text-foreground">{app.protocolId}</span>
              <span className="font-mono text-muted-foreground">@{app.protocolVersion}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div><div className="text-muted-foreground">org</div><div className="font-mono">{app.organizationId}</div></div>
              <div><div className="text-muted-foreground">tenant</div><div className="font-mono">{app.tenantId}</div></div>
              <div><div className="text-muted-foreground">domain</div><div className="font-mono">{app.primaryDomain ?? "—"}</div></div>
              <div><div className="text-muted-foreground">path</div><div className="font-mono">{app.pathPrefix}</div></div>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(app.featureFlags).map(([k, v]) => (
                <Badge key={k} variant="outline" className={`text-[9px] font-mono ${v ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {k}: {v ? "on" : "off"}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] pt-1 border-t">
              <span className="text-muted-foreground">nav: <span className="font-mono text-foreground">{app.navigationCount}</span></span>
              <span className="text-muted-foreground">locales: <span className="font-mono text-foreground">{app.localeCount}</span></span>
              <span className="text-muted-foreground">auth: <span className="font-mono text-foreground">{app.authProviderCount}</span></span>
              <span className="text-muted-foreground">ui: <span className="font-mono text-foreground">{app.uiExtensionCount}</span></span>
              <span className="text-muted-foreground">config: <span className="font-mono text-foreground">{app.configFieldCount}</span></span>
              <span className="text-muted-foreground">versions: <span className="font-mono text-foreground">{app.versionHistoryCount}</span></span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrganizationsTab({ demo }: { demo: KernelDemoResult }) {
  const orgs = demo.platformSnapshot?.organizations ?? [];
  if (orgs.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No organizations registered.</div>;
  }
  return (
    <div className="space-y-3">
      {orgs.map((org) => (
        <Card key={org.id}>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{org.id}</span>
              <Badge variant="outline" className={statusColor(org.status)}>{org.status}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div><div className="text-muted-foreground">tenant</div><div className="font-mono">{org.tenantId}</div></div>
              <div><div className="text-muted-foreground">applications</div><div className="font-mono">{org.applicationCount}</div></div>
              <div><div className="text-muted-foreground">members</div><div className="font-mono">{org.memberCount}</div></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CompilerTab({ demo }: { demo: KernelDemoResult }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Stage trace</CardTitle>
          <CardDescription>9-stage pipeline: Intent → ExecutionGraph</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <span>phase</span><span>stage</span><span className="text-right">result</span>
            </div>
            <Separator />
            {demo.compiler.stages.map((s) => (
              <div key={s.name} className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-3 py-2 text-xs items-center hover:bg-muted/30">
                <Badge variant="outline" className={`text-[9px] font-mono ${s.error ? "border-destructive/30 text-destructive" : "text-muted-foreground"}`}>{s.phase}</Badge>
                <span className="font-mono">{s.name}</span>
                <span className={`font-mono text-right text-[10px] ${s.error ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>{s.error ? "aborted" : "ok"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Output graph</CardTitle></CardHeader>
        <CardContent>
          <div className={`rounded-lg border p-4 ${demo.compiler.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={demo.compiler.ok ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}>
                {demo.compiler.ok ? "COMPILED" : "FAILED"}
              </Badge>
              {demo.compiler.graphId && <span className="text-xs text-muted-foreground font-mono">{demo.compiler.graphId}</span>}
            </div>
            {demo.compiler.ok && (
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div><div className="text-muted-foreground">nodes</div><div className="font-mono tabular-nums">{demo.compiler.nodeCount}</div></div>
                <div><div className="text-muted-foreground">edges</div><div className="font-mono tabular-nums">{demo.compiler.edgeCount}</div></div>
                <div><div className="text-muted-foreground">tasks</div><div className="font-mono tabular-nums">{demo.compiler.taskCount}</div></div>
                <div><div className="text-muted-foreground">seed</div><div className="font-mono tabular-nums">{demo.compiler.seed}</div></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {demo.compiler.diagnostics.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Diagnostics</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {demo.compiler.diagnostics.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${d.severity === "error" ? "border-destructive/30 text-destructive" : d.severity === "warn" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{d.severity}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">{d.code}</span>
                  <span className="text-foreground/80">{d.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EventsTab({ demo }: { demo: KernelDemoResult }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Event store</CardTitle>
          <CardDescription>Append-only, optimistic concurrency, event-sourced</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <span>eventId (seeded UUID)</span><span className="text-right">eventType</span><span className="text-right">version</span>
            </div>
            <Separator />
            {demo.events.map((e) => (
              <div key={e.eventId} className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 text-xs items-center hover:bg-muted/30">
                <span className="font-mono text-[11px] break-all text-foreground/80">{e.eventId}</span>
                <span className="font-mono text-right text-foreground">{e.eventType}</span>
                <span className="font-mono text-right text-muted-foreground tabular-nums">v{e.version}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Replay invariant</CardTitle></CardHeader>
        <CardContent>
          <div className={`rounded-lg border p-4 ${demo.determinism.identical ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
            <Badge variant="outline" className={demo.determinism.identical ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}>
              {demo.determinism.identical ? "REPLAY INVARIANT HOLDS" : "INVARIANT BROKEN"}
            </Badge>
            <p className="text-[11px] text-muted-foreground mt-2">
              Second SeededRandomSource({demo.determinism.seed}) reproduces the identical UUID sequence.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectionsTab({ demo }: { demo: KernelDemoResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Projection — {demo.projection.name}</CardTitle>
        <CardDescription>Pure (event, state) → state. Read models never mutated by query code.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {Object.entries(demo.projection.state).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="font-mono">{k} <span className="ml-1 tabular-nums">{v}</span></Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RegistriesTab({ demo }: { demo: KernelDemoResult }) {
  const caps = demo.platformSnapshot?.capabilities ?? [];
  const intents = demo.platformSnapshot?.intentTypes ?? [];
  const workflows = demo.platformSnapshot?.workflows ?? [];
  const policies = demo.platformSnapshot?.policies ?? [];
  const exts = demo.platformSnapshot?.compilerExtensions ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Zap className="size-3.5" /> Capabilities ({caps.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {caps.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span className="font-mono">{c.capabilityType}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px] font-mono">{c.ownerProtocolId.split(".").pop()}</Badge>
                  <span className="text-[10px] text-muted-foreground">{c.inputCount}in/{c.outputCount}out</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Eye className="size-3.5" /> Intent Types ({intents.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {intents.map((i) => (
              <div key={i.intentType} className="flex items-center justify-between text-xs">
                <span className="font-mono">{i.intentType}</span>
                <span className="text-[10px] text-muted-foreground">{i.requiredCapabilityCount} caps · {i.compilerHookCount} hooks</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Workflow className="size-3.5" /> Workflows ({workflows.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {workflows.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-xs">
                <span className="font-mono">{w.name}</span>
                <span className="text-[10px] text-muted-foreground">{w.stageCount} stages</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="size-3.5" /> Policies ({policies.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {policies.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="font-mono">{p.name}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[9px] ${p.effect === "deny" ? "border-destructive/30 text-destructive" : "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"}`}>{p.effect}</Badge>
                  <span className="text-[10px] text-muted-foreground">{p.ruleCount} rules</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="size-3.5" /> Compiler Extensions ({exts.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {exts.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-xs">
                <span className="font-mono">{e.name}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px] font-mono">{e.phase}</Badge>
                  <Badge variant="outline" className="text-[9px] font-mono border-teal-500/30 text-teal-700 dark:text-teal-400">{e.insertion}</Badge>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Protocol stages extend the kernel pipeline — never replace. Names must not start with <span className="font-mono">kernel.</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ExchangeTab({ demo }: { demo: KernelDemoResult }) {
  const c = demo.coordination;
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="size-4" /> Coordination spine
          </CardTitle>
          <CardDescription>
            Demand A → Capability X → Resource R → Reservation → Commitment → Assignment → Acceptance.
            The coordination kernel orchestrates WHO performs work; it never performs work itself (ADR-0015).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Outcome badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">outcome:</span>
            <Badge
              variant="outline"
              className={
                c.outcome === "assigned"
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/40 text-destructive"
              }
            >
              {c.outcome}
            </Badge>
            <span className="text-xs text-muted-foreground">
              ({c.candidateCount} candidate{c.candidateCount === 1 ? "" : "s"} matched)
            </span>
          </div>

          {/* Spine steps */}
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <span>step</span><span>detail</span><span className="text-right">result</span>
            </div>
            <Separator />
            {c.steps.map((s, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-3 py-2 text-xs items-center hover:bg-muted/30">
                <Badge variant="outline" className="text-[9px] font-mono">{s.step}</Badge>
                <span className="font-mono text-foreground/80">{s.detail}</span>
                <span className={`font-mono text-right text-[10px] ${s.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  {s.ok ? "ok" : "fail"}
                </span>
              </div>
            ))}
          </div>

          {/* Coordination artifacts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md border p-2.5">
              <div className="text-[10px] text-muted-foreground">matched resource</div>
              <div className="font-mono text-xs text-foreground">{c.matchResourceId ?? "—"}</div>
            </div>
            <div className="rounded-md border p-2.5">
              <div className="text-[10px] text-muted-foreground">match score</div>
              <div className="font-mono text-sm tabular-nums">{c.matchScore ?? "—"}</div>
            </div>
            <div className="rounded-md border p-2.5">
              <div className="text-[10px] text-muted-foreground">reservation</div>
              <div className="font-mono text-[10px] text-foreground break-all">{c.reservationId ?? "—"}</div>
            </div>
            <div className="rounded-md border p-2.5">
              <div className="text-[10px] text-muted-foreground">commitment</div>
              <div className="font-mono text-[10px] text-foreground break-all">{c.commitmentId ?? "—"}</div>
            </div>
          </div>

          {/* Assignment */}
          {c.assignmentId && (
            <div className="rounded-lg border border-lime-500/20 bg-lime-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="border-lime-500/40 text-lime-700 dark:text-lime-400 font-mono">
                  assignment
                </Badge>
                <span className="font-mono text-xs text-foreground">{c.assignmentId}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                status: <span className="font-mono text-foreground">{c.assignmentStatus}</span>
              </div>
            </div>
          )}

          {/* Engine summary */}
          <div className="rounded-lg border border-muted p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Engines (8)</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "matching", "negotiation", "reservation", "commitment",
                "assignment", "queue", "transfer", "escalation",
              ].map((e) => (
                <Badge key={e} variant="outline" className="text-[9px] font-mono border-lime-500/20 text-lime-700 dark:text-lime-400">
                  {e}
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Marketplace is ONE strategy on top of the coordination kernel — using Offers + Bids + Matching.
              Direct assignment, fixed schedules, and regulatory workflows are equally first-class.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResourcesTab({ demo }: { demo: KernelDemoResult }) {
  const rk = demo.resourceKernel;
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4" /> Resource Registry
          </CardTitle>
          <CardDescription>
            Universal resource concepts — state, availability, capacity, location, calendar,
            skills, certification, twin, maintenance, quality. The coordination kernel queries
            "give me resources capable of X" (ADR-0016).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Query result */}
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              findCapable(capabilityType: <span className="font-mono text-foreground">{rk.queryCapabilityType}</span>)
            </div>
            <div className="text-[11px] text-muted-foreground">
              {rk.capableResults.length} resource(s) matched · ranked by availability → certification → capacity → confidence
            </div>
          </div>

          {/* Resource cards */}
          {rk.resources.map((r) => {
            const isCapable = rk.capableResults.some((c) => c.id === r.id);
            return (
              <div key={r.id} className={`rounded-lg border p-3 space-y-2 ${isCapable ? "border-cyan-500/30" : "border-muted"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.displayName}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{r.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCapable && (
                      <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-700 dark:text-cyan-400">
                        capable
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[9px] ${r.operationalState === "idle" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {r.operationalState}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  <div>
                    <div className="text-muted-foreground">health</div>
                    <div className="font-mono tabular-nums">{(r.healthScore * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">reliability</div>
                    <div className="font-mono tabular-nums">{(r.reliabilityScore * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">capacity</div>
                    <div className="font-mono tabular-nums">{r.capacityRemaining}/{r.capacityMax}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">certs</div>
                    <div className="font-mono tabular-nums">{r.certificationCount}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {r.location && <span><span className="text-muted-foreground">location:</span> <span className="font-mono text-foreground">{r.location}</span></span>}
                  {r.certified !== undefined && (
                    <span>certified: <span className={r.certified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>{String(r.certified)}</span></span>
                  )}
                  {r.confidence !== undefined && <span>confidence: <span className="font-mono tabular-nums">{(r.confidence * 100).toFixed(0)}%</span></span>}
                  {r.matchScore !== undefined && <span>score: <span className="font-mono tabular-nums">{r.matchScore.toFixed(2)}</span></span>}
                </div>
                {/* Twin indicator */}
                <div className="flex items-center gap-1.5 text-[10px] pt-1 border-t">
                  <Badge variant="outline" className="text-[9px] font-mono border-violet-500/20 text-violet-700 dark:text-violet-400">
                    twin
                  </Badge>
                  <span className="text-muted-foreground">updated at <span className="font-mono">{r.twinUpdatedAt}</span></span>
                </div>
              </div>
            );
          })}

          {/* Engine summary */}
          <div className="rounded-lg border border-muted p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Engines (9)</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "resource-registry", "availability", "capacity", "location",
                "calendar", "skills", "twin", "maintenance", "quality",
              ].map((e) => (
                <Badge key={e} variant="outline" className="text-[9px] font-mono border-cyan-500/20 text-cyan-700 dark:text-cyan-400">
                  {e}
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Every resource has a digital twin (current state, history, predictions, telemetry).
              Location is an abstraction — not GPS — so mobility uses roads, cleaning uses buildings,
              healthcare uses hospital wings through the same interface.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KnowledgeTab({ demo }: { demo: KernelDemoResult }) {
  const kk = demo.knowledgeKernel;
  return (
    <div className="space-y-3">
      {/* Query result */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" /> Knowledge Explorer
          </CardTitle>
          <CardDescription>
            Universal operational knowledge — SOPs, regulations, standards, facts, procedures.
            Protocols register knowledge; the kernel owns storage, versioning, provenance,
            confidence, and applicability (ADR-0017).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* The query */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              lookup(subjectKind: <span className="font-mono text-foreground">{kk.query.subjectKind}</span>, subjectId: <span className="font-mono text-foreground">{kk.query.subjectId}</span>)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md border p-2">
                <div className="text-[10px] text-muted-foreground">items</div>
                <div className="font-mono text-lg tabular-nums">{kk.query.matchedItems}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[10px] text-muted-foreground">procedures</div>
                <div className="font-mono text-lg tabular-nums">{kk.query.matchedProcedures}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[10px] text-muted-foreground">regulations</div>
                <div className="font-mono text-lg tabular-nums">{kk.query.matchedRegulations}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[10px] text-muted-foreground">facts</div>
                <div className="font-mono text-lg tabular-nums">{kk.query.matchedFacts}</div>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className={`rounded-lg border p-3 ${kk.query.complianceCompliant ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={kk.query.complianceCompliant ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}>
                {kk.query.complianceCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {kk.query.complianceViolations} violation(s) found
              </span>
            </div>
          </div>

          {/* Registered knowledge items */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Registered knowledge items ({kk.items.length})</div>
            {kk.items.map((ki) => (
              <div key={ki.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] font-mono ${
                      ki.kind === "procedure" ? "border-blue-500/30 text-blue-700 dark:text-blue-400" :
                      ki.kind === "regulation" ? "border-red-500/30 text-red-700 dark:text-red-400" :
                      ki.kind === "fact" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" :
                      "text-muted-foreground"
                    }`}>{ki.kind}</Badge>
                    <span className="text-sm font-medium">{ki.title}</span>
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${ki.status === "active" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {ki.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>confidence: <span className="font-mono tabular-nums">{(ki.confidence * 100).toFixed(0)}%</span></span>
                  <span>evidence: <span className="font-mono tabular-nums">{ki.evidenceCount}</span></span>
                  <span>version: <span className="font-mono tabular-nums">{ki.version}</span></span>
                  {ki.ownerProtocolId && <span>owner: <span className="font-mono">{ki.ownerProtocolId}</span></span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {ki.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[9px] font-mono">{t}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Registry summary */}
          <div className="rounded-lg border border-muted p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Registries (14)</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "source", "evidence", "knowledge", "fact", "procedure",
                "standard", "regulation", "guideline", "ontology",
                "taxonomy", "vocabulary", "measurement", "hypothesis",
                "query-engine",
              ].map((r) => (
                <Badge key={r} variant="outline" className="text-[9px] font-mono border-amber-500/20 text-amber-700 dark:text-amber-400">
                  {r}
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              The compiler asks "what procedures apply?" The coordination kernel asks "find resources
              certified for SOP-32, compliant with Regulation-9." Digital twins become intelligent:
              twin → knowledge → recommendations → predictions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DomainsTab({ demo }: { demo: KernelDemoResult }) {
  const dm = demo.domainModeling;
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BoxesIcon className="size-4" /> Domain Explorer
          </CardTitle>
          <CardDescription>
            The semantic layer — entity types, relationships, state machines, measurements, constraints.
            Domain Definition (semantics) is separate from Protocol (behavior): many protocols share
            one domain (ADR-0018).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Domain summary */}
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[9px] font-mono border-rose-500/30 text-rose-700 dark:text-rose-400">
                domain
              </Badge>
              <span className="font-mono text-sm font-medium">{dm.domainId}</span>
              <span className="text-xs text-muted-foreground">v{dm.version}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="rounded-md border p-2"><div className="text-[10px] text-muted-foreground">entities</div><div className="font-mono text-lg tabular-nums">{dm.entityTypeCount}</div></div>
              <div className="rounded-md border p-2"><div className="text-[10px] text-muted-foreground">relationships</div><div className="font-mono text-lg tabular-nums">{dm.relationshipCount}</div></div>
              <div className="rounded-md border p-2"><div className="text-[10px] text-muted-foreground">state machines</div><div className="font-mono text-lg tabular-nums">{dm.stateMachineCount}</div></div>
              <div className="rounded-md border p-2"><div className="text-[10px] text-muted-foreground">measurements</div><div className="font-mono text-lg tabular-nums">{dm.measurementCount}</div></div>
              <div className="rounded-md border p-2"><div className="text-[10px] text-muted-foreground">constraints</div><div className="font-mono text-lg tabular-nums">{dm.constraintCount}</div></div>
            </div>
          </div>

          {/* Entity types */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Entity types ({dm.entityTypes.length})</div>
            {dm.entityTypes.map((et) => (
              <div key={et.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{et.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{et.id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {et.twinEnabled && (
                      <Badge variant="outline" className="text-[9px] border-violet-500/20 text-violet-700 dark:text-violet-400">twin</Badge>
                    )}
                    {et.hasStateMachine && (
                      <Badge variant="outline" className="text-[9px] border-blue-500/20 text-blue-700 dark:text-blue-400">state</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>attributes: <span className="font-mono tabular-nums">{et.attributeCount}</span></span>
                  <span>relationships: <span className="font-mono tabular-nums">{et.relationshipCount}</span></span>
                </div>
              </div>
            ))}
          </div>

          {/* Relationship graph */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Relationship graph ({dm.relationships.length})</div>
            {dm.relationships.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5">
                <span className="font-mono text-foreground">{r.source}</span>
                <Badge variant="outline" className="text-[9px] font-mono border-rose-500/20 text-rose-700 dark:text-rose-400">{r.kind}</Badge>
                <span className="font-mono text-foreground">{r.target}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{r.cardinality}</span>
              </div>
            ))}
          </div>

          {/* Layering note */}
          <div className="rounded-lg border border-muted p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">Architectural layering</div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
              <Badge variant="outline" className="text-[9px] border-amber-500/20 text-amber-700 dark:text-amber-400">Knowledge</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="text-[9px] border-rose-500/20 text-rose-700 dark:text-rose-400">Domain Definition</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="text-[9px] border-teal-500/20 text-teal-700 dark:text-teal-400">Protocol</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="text-[9px] border-pink-500/20 text-pink-700 dark:text-pink-400">Application</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Creating a new industry becomes declarative: define a domain, install a protocol, launch an application.
              Many protocols (residential, commercial, hospital, industrial) share one domain definition.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PackagesTab({ demo }: { demo: KernelDemoResult }) {
  const c = demo.composition;
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageIcon className="size-4" /> Operational Package
          </CardTitle>
          <CardDescription>
            Protocol source → Composition pipeline → immutable .opspkg → install → activate.
            Applications install packages, not protocol source (ADR-0019).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Package identity */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[9px] font-mono border-purple-500/30 text-purple-700 dark:text-purple-400">
                .opspkg
              </Badge>
              <span className="font-mono text-sm font-medium">{c.packageId || "—"}</span>
              <span className="text-xs text-muted-foreground">v{c.version}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {c.compiled && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">COMPILED</Badge>}
              {c.signed && <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-700 dark:text-blue-400">SIGNED</Badge>}
              {c.installed && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">INSTALLED</Badge>}
              {c.activated && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">ACTIVATED</Badge>}
            </div>
            {c.digest && (
              <div className="text-[10px] text-muted-foreground mt-2">
                digest: <span className="font-mono text-foreground/80">{c.digest}</span>
              </div>
            )}
          </div>

          {/* Composition pipeline */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Composition pipeline</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {c.stages.map((s, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[9px] font-mono ${s.ok ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}`}>
                    {s.stage}
                  </Badge>
                  {i < c.stages.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Lifecycle events */}
          {c.lifecycleEvents.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Install lifecycle</div>
              <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                {c.lifecycleEvents.map((e, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] py-0">{e.from}→{e.to}</Badge>
                    {i < c.lifecycleEvents.length - 1 && <span className="text-muted-foreground">·</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Package contents */}
          {c.contentCounts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Package contents</div>
              <div className="flex flex-wrap gap-1.5">
                {c.contentCounts.map((cc) => (
                  <Badge key={cc.kind} variant="secondary" className="font-mono text-[10px]">
                    {cc.kind} <span className="ml-1 tabular-nums">{cc.count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline note */}
          <div className="rounded-lg border border-muted p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">The deployment artifact</div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
              <Badge variant="outline" className="text-[9px] border-amber-500/20 text-amber-700 dark:text-amber-400">Knowledge</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="text-[9px] border-rose-500/20 text-rose-700 dark:text-rose-400">Domain</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="text-[9px] border-teal-500/20 text-teal-700 dark:text-teal-400">Protocol</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-700 dark:text-purple-400">Package</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="text-[9px] border-pink-500/20 text-pink-700 dark:text-pink-400">Application</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              The package is immutable, versioned, validated, signed, and installable. Like a Docker image or Helm chart — not an npm library. Supports rollback, upgrade, offline distribution, and marketplace publishing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SimulationTab({ demo }: { demo: KernelDemoResult }) {
  const c = demo.conformance;
  return (
    <div className="space-y-3">
      {/* Suite summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4" /> Conformance Suite
          </CardTitle>
          <CardDescription>
            25 generic, industry-neutral scenarios validating kernel neutrality.
            Every future protocol must pass before packaging (ADR-0020).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-[10px] text-muted-foreground">scenarios</div>
              <div className="font-mono text-lg tabular-nums">{c.totalScenarios}</div>
            </div>
            <div className="rounded-lg border p-3 border-emerald-500/20">
              <div className="text-[10px] text-muted-foreground">passed</div>
              <div className="font-mono text-lg tabular-nums text-emerald-600 dark:text-emerald-400">{c.passed}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[10px] text-muted-foreground">failed</div>
              <div className={`font-mono text-lg tabular-nums ${c.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>{c.failed}</div>
            </div>
            <div className="rounded-lg border p-3 border-emerald-500/20">
              <div className="text-[10px] text-muted-foreground">replay verified</div>
              <div className={`font-mono text-sm ${c.replayVerified ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {c.replayVerified ? "✓ ALL" : "✗ FAIL"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[10px] text-muted-foreground">checksum</div>
              <div className="font-mono text-[10px] text-foreground/80 break-all">{c.deterministicChecksum}</div>
            </div>
          </div>

          {/* Status banner */}
          <div className={`rounded-lg border p-3 ${c.failed === 0 && c.replayVerified ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={c.failed === 0 && c.replayVerified ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}>
                {c.failed === 0 && c.replayVerified ? "ALL SCENARIOS PASS — KERNEL CONFORMANT" : "CONFORMANCE FAILURES DETECTED"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              The deterministic checksum is byte-identical across runs. Every scenario was simulated twice with the same seed; replay verification confirms identical results. This is the kernel's contract: identical inputs → identical outputs, always.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scenario results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Scenario results ({c.scenarios.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {c.scenarios.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5 hover:bg-muted/30">
                <span className={`size-2 rounded-full shrink-0 ${s.passed ? "bg-emerald-500" : "bg-destructive"}`} />
                <span className="font-mono text-foreground shrink-0">{s.id}</span>
                <span className="text-muted-foreground truncate flex-1">{s.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {s.assertionsPassed}/{s.assertionsTotal} assertions
                </span>
                {s.replayVerified && (
                  <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shrink-0">
                    replay ✓
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{s.durationMs}ms</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">What the suite validates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {[
              "event-replay-determinism", "resource-allocation", "knowledge-lookup",
              "compiler-correctness", "policy-reproducibility", "coordination",
              "scheduling", "package-integrity", "extension-lifecycle",
              "failure-injection", "queue-disciplines", "negotiation",
              "escalation", "transfer-provenance", "twin-updates",
            ].map((cat) => (
              <Badge key={cat} variant="outline" className="text-[9px] font-mono border-green-500/20 text-green-700 dark:text-green-400">
                {cat}
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            These validate universal kernel behavior — not cleaning, not mobility, not healthcare.
            Every future protocol inherits this suite automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function IntelligenceTab({ demo }: { demo: KernelDemoResult }) {
  const i = demo.intelligence;
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainIcon className="size-4" /> Operational Intelligence
          </CardTitle>
          <CardDescription>
            Sits ACROSS the kernel — observes, explains, predicts, recommends.
            Never performs work. Never modifies state. AI providers implement
            contracts; the kernel owns what intelligence means (ADR-0021).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Intelligence graph stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-[10px] text-muted-foreground">graph nodes</div>
              <div className="font-mono text-lg tabular-nums">{i.graphNodeCount}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[10px] text-muted-foreground">graph edges</div>
              <div className="font-mono text-lg tabular-nums">{i.graphEdgeCount}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[10px] text-muted-foreground">learning signals</div>
              <div className="font-mono text-lg tabular-nums">{i.learningSignals}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[10px] text-muted-foreground">AI contracts</div>
              <div className="font-mono text-lg tabular-nums">{i.aiContracts.length}</div>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Explanation</div>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-mono border-orange-500/30 text-orange-700 dark:text-orange-400">{i.explanation.kind}</Badge>
                <span className="text-[11px] text-muted-foreground">confidence: <span className="font-mono tabular-nums">{(i.explanation.confidence * 100).toFixed(0)}%</span></span>
              </div>
              <p className="text-xs text-foreground/80">{i.explanation.rationale}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>evidence: <span className="font-mono tabular-nums">{i.explanation.evidenceCount}</span></span>
                <span>alternatives: <span className="font-mono tabular-nums">{i.explanation.alternativeCount}</span></span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Recommendations (advisory only)</div>
            {i.recommendations.length > 0 ? (
              <div className="space-y-1">
                {i.recommendations.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5">
                    <Badge variant="outline" className="text-[9px] font-mono border-orange-500/20 text-orange-700 dark:text-orange-400">{r.category}</Badge>
                    <span className="text-foreground/80 flex-1 truncate">{r.action}</span>
                    <Badge variant="outline" className={`text-[9px] ${r.impact === "high" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : r.impact === "medium" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{r.impact}</Badge>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{(r.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">No recommendations.</div>
            )}
          </div>

          {/* Predictions */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Predictions (deterministic mock — no ML)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {i.predictions.map((p, idx) => (
                <div key={idx} className="rounded-md border p-2.5">
                  <div className="text-[10px] text-muted-foreground">{p.metric}</div>
                  <div className="font-mono text-sm tabular-nums">{p.value.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">conf: <span className="font-mono tabular-nums">{(p.confidence * 100).toFixed(0)}%</span></div>
                  <div className="text-[9px] text-muted-foreground font-mono">{p.method}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Anomalies */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Anomalies detected</div>
            {i.anomalies.length > 0 ? (
              <div className="space-y-1">
                {i.anomalies.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5">
                    <Badge variant="outline" className={`text-[9px] font-mono ${a.severity === "critical" ? "border-destructive/30 text-destructive" : a.severity === "warn" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{a.severity}</Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{a.kind}</span>
                    <span className="text-foreground/80 flex-1 truncate">{a.description}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">No anomalies detected.</div>
            )}
          </div>

          {/* AI contracts */}
          <div className="rounded-lg border border-muted p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">AI Integration Contracts (interfaces only)</div>
            <div className="flex flex-wrap gap-1.5">
              {i.aiContracts.map((c) => (
                <Badge key={c} variant="outline" className="text-[9px] font-mono border-orange-500/20 text-orange-700 dark:text-orange-400">
                  {c}
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Today GPT, tomorrow a domain planner or RL system — none change the kernel.
              The kernel owns WHAT intelligence means; AI providers supply HOW it's produced.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GovernanceTab({ demo }: { demo: KernelDemoResult }) {
  const g = demo.governance;
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> Platform Governance
          </CardTitle>
          <CardDescription>
            Governs how OpsOS evolves — version compatibility, migration, lifecycle,
            certification, and policies. Never changes operational behavior (ADR-0022).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Version artifacts */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Version artifacts ({g.versions.length})</div>
            <div className="space-y-1">
              {g.versions.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5">
                  <Badge variant="outline" className="text-[9px] font-mono border-blue-500/20 text-blue-700 dark:text-blue-400">{v.kind}</Badge>
                  <span className="font-mono text-foreground">{v.id}</span>
                  <span className="font-mono text-muted-foreground">v{v.version}</span>
                  <Badge variant="outline" className={`text-[9px] ml-auto ${v.lifecycle === "stable" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : v.lifecycle === "deprecated" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : v.lifecycle === "retired" ? "border-destructive/30 text-destructive" : "text-muted-foreground"}`}>
                    {v.lifecycle}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Compatibility matrix */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Compatibility matrix</div>
            <div className="space-y-1">
              {g.compatibilityResults.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5">
                  <Badge variant="outline" className={`text-[9px] font-mono ${c.compatible ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "border-destructive/30 text-destructive"}`}>
                    {c.compatible ? "✓ compatible" : "✗ incompatible"}
                  </Badge>
                  <span className="font-mono text-muted-foreground">{c.dimension}</span>
                  <span className="text-foreground/70 flex-1 truncate">{c.details}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Certifications</div>
            <div className="space-y-1">
              {g.certifications.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5">
                  <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-700 dark:text-emerald-400">{c.kind}</Badge>
                  <span className="font-mono text-foreground">{c.subjectId}</span>
                  <Badge variant="outline" className="text-[9px] ml-auto border-emerald-500/30 text-emerald-700 dark:text-emerald-400">{c.status}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Migration */}
          {g.migrationPlan && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Migration plan</div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-mono border-blue-500/30 text-blue-700 dark:text-blue-400">{g.migrationPlan.type}</Badge>
                  <span className="font-mono text-xs">{g.migrationPlan.from} → {g.migrationPlan.to}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {g.migrationPlan.stepCount} steps · dry-run: <span className={g.migrationPlan.dryRunOk ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{g.migrationPlan.dryRunOk ? "✓ passed" : "✗ failed"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Policies */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Governance policies ({g.policies.length})</div>
            <div className="space-y-1">
              {g.policies.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5">
                  <span className="font-mono text-foreground">{p.kind}</span>
                  <Badge variant="outline" className={`text-[9px] ml-auto ${p.enforcement === "blocking" ? "border-destructive/30 text-destructive" : p.enforcement === "required" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {p.enforcement}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Lifecycle states */}
          <div className="rounded-lg border border-muted p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Feature lifecycle</div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
              {g.lifecycleStates.map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <Badge variant="outline" className={`text-[9px] ${s === "stable" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : s === "deprecated" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : s === "retired" ? "border-destructive/30 text-destructive" : "text-muted-foreground"}`}>{s}</Badge>
                  {i < g.lifecycleStates.length - 1 && <span className="text-muted-foreground">→</span>}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Stable cannot skip to retired — must pass through deprecated first (Kubernetes-style deprecation policy).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ObservabilityTab({ demo }: { demo: KernelDemoResult }) {
  const obs = demo.platformSnapshot?.observability;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="size-3.5" /> Events</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold">{obs?.eventCount ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">total events in store</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Bug className="size-3.5" /> Decision Provenance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold">{obs?.decisions.length ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">recorded decisions</div>
          </CardContent>
        </Card>
      </div>
      {demo.decision && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Latest policy decision</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`font-mono uppercase ${demo.decision.outcome === "deny" ? "border-destructive/40 text-destructive" : demo.decision.outcome === "allow" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : ""}`}>{demo.decision.outcome}</Badge>
              <span className="text-xs font-mono text-muted-foreground">{demo.decision.decisionId}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">{demo.decision.rationale}</div>
            <div className="text-[10px] text-muted-foreground">
              provenance: inputHash={demo.decision.inputHash ?? "—"}, sources={demo.decision.sourceEventCount}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ArchitectureTab({ demo }: { demo: KernelDemoResult }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Kernel modules ({demo.modules.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {demo.modules.map((m) => (
              <div key={m.name} className="rounded-lg border p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium">{m.name}</span>
                  <Badge variant="outline" className={`text-[9px] ${layerColor(m.layer)}`}>{m.layer}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Canonical primitives ({demo.primitives.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {demo.primitives.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-md border px-2.5 py-1.5">
                <span className="font-mono text-[11px] font-medium">{p.name}</span>
                <span className="text-[9px] text-muted-foreground">{p.owner}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Architecture invariants</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "Deterministic Runtime", d: "All time from RuntimeClock; all randomness from seeded RandomSource." },
              { t: "Event Sourcing", d: "Aggregates emit immutable events; state derived by replay." },
              { t: "CQRS", d: "Commands through aggregates; queries read projections only." },
              { t: "Compiler Creates Work", d: "Intent → compile() → ExecutionGraph → execute() → Execution." },
              { t: "Protocols Describe", d: "Industries extend through registration only (ADR-0012)." },
              { t: "Apps Are Protocol Instances", d: "One protocol → many branded apps (ADR-0013)." },
              { t: "Frozen API v1", d: "Everything outside imports from @kernel/api/v1." },
              { t: "Frozen Language", d: "19 primitives — additive evolution only." },
              { t: "Control Plane Read-Only", d: "Admin surface, platform-admin only (ADR-0014)." },
            ].map((i) => (
              <div key={i.t} className="rounded-lg border p-2.5">
                <div className="text-xs font-medium">{i.t}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{i.d}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const TABS: readonly TabDef[] = [
  { id: "overview", label: "Overview", icon: Heart },
  { id: "protocols", label: "Protocols", icon: PackageIcon },
  { id: "applications", label: "Applications", icon: Globe },
  { id: "organizations", label: "Organizations", icon: Network },
  { id: "compiler", label: "Compiler", icon: Brain },
  { id: "events", label: "Events", icon: Database },
  { id: "projections", label: "Projections", icon: Layers },
  { id: "registries", label: "Registries", icon: Boxes },
  { id: "exchange", label: "Exchange", icon: ArrowLeftRight },
  { id: "resources", label: "Resources", icon: MapPin },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "domains", label: "Domains", icon: BoxesIcon },
  { id: "packages", label: "Packages", icon: PackageIcon },
  { id: "simulation", label: "Simulation", icon: FlaskConical },
  { id: "intelligence", label: "Intelligence", icon: BrainIcon },
  { id: "governance", label: "Governance", icon: ShieldCheck },
  { id: "observability", label: "Observability", icon: Activity },
  { id: "architecture", label: "Architecture", icon: Grid3x3 },
];

export function ControlPlaneClient({ demo }: { demo: KernelDemoResult }) {
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-lg bg-foreground text-background grid place-items-center font-mono font-bold text-xs">K</div>
            <div className="leading-tight">
              <div className="font-semibold text-sm tracking-tight">OpsOS Control Plane</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5">Platform Administration</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-700 dark:text-indigo-400">
              <Shield className="size-3 mr-1" /> Admin
            </Badge>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[10px]">read-only</Badge>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="sticky top-14 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-1.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Tab content */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6">
        {activeTab === "overview" && <OverviewTab demo={demo} />}
        {activeTab === "protocols" && <ProtocolsTab demo={demo} />}
        {activeTab === "applications" && <ApplicationsTab demo={demo} />}
        {activeTab === "organizations" && <OrganizationsTab demo={demo} />}
        {activeTab === "compiler" && <CompilerTab demo={demo} />}
        {activeTab === "events" && <EventsTab demo={demo} />}
        {activeTab === "projections" && <ProjectionsTab demo={demo} />}
        {activeTab === "registries" && <RegistriesTab demo={demo} />}
        {activeTab === "exchange" && <ExchangeTab demo={demo} />}
        {activeTab === "resources" && <ResourcesTab demo={demo} />}
        {activeTab === "knowledge" && <KnowledgeTab demo={demo} />}
        {activeTab === "domains" && <DomainsTab demo={demo} />}
        {activeTab === "packages" && <PackagesTab demo={demo} />}
        {activeTab === "simulation" && <SimulationTab demo={demo} />}
        {activeTab === "intelligence" && <IntelligenceTab demo={demo} />}
        {activeTab === "governance" && <GovernanceTab demo={demo} />}
        {activeTab === "observability" && <ObservabilityTab demo={demo} />}
        {activeTab === "architecture" && <ArchitectureTab demo={demo} />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 py-4 flex items-center justify-between text-[11px] text-muted-foreground">
          <span><span className="font-mono text-foreground">OpsOS</span> Control Plane · Milestones 1–5</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {demo.modules.length} modules · {demo.primitives.length} primitives
          </Badge>
        </div>
      </footer>
    </div>
  );
}
