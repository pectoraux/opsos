import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { runKernelDemo, type KernelDemoResult } from "@/lib/kernel-demo";

export const dynamic = "force-dynamic";

function Monospace({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] break-all text-foreground/80">
      {children}
    </span>
  );
}

function outcomeVariant(outcome: string) {
  if (outcome === "deny") return "destructive" as const;
  if (outcome === "allow") return "default" as const;
  return "secondary" as const;
}

function layerColor(layer: string) {
  switch (layer) {
    case "Foundation":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    case "Engine":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case "Context":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
    case "Read side":
      return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20";
    case "Governance":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20";
    case "Host":
      return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default async function Home() {
  const demo: KernelDemoResult = await runKernelDemo();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-foreground text-background grid place-items-center font-mono font-bold text-sm">
              K
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">OpsOS</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">
                Operations Operating System
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
              Milestone 1
            </Badge>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Kernel Foundation
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-6xl px-4 py-10 space-y-12">
        {/* Hero */}
        <section className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            The Kernel Foundation
          </h1>
          <p className="text-muted-foreground max-w-3xl text-base sm:text-lg">
            An immutable, deterministic core. OpsOS does not yet know what
            cleaning, laundry, delivery, or healthcare is — it understands only
            universal operational concepts. Industry behavior will later be
            installed as <span className="font-medium text-foreground">protocols</span>,
            never by modifying the kernel.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{demo.modules.length} kernel modules</Badge>
            <Badge variant="outline">{demo.primitives.length} canonical primitives</Badge>
            <Badge
              variant="outline"
              className={
                demo.determinism.identical
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/40 text-destructive"
              }
            >
              {demo.determinism.identical ? "✓ deterministic" : "✗ non-deterministic"}
            </Badge>
            <Badge variant="outline">Clean Architecture · DDD · CQRS · Event Sourcing</Badge>
          </div>
        </section>

        {/* Deterministic Event Flow */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">Deterministic Event Flow</h2>
            <span className="text-xs text-muted-foreground">
              EventStore · optimistic concurrency · seeded IDs
            </span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appended events</CardTitle>
              <CardDescription>
                Three events appended to an Organization stream. Versions are
                monotonic per stream; timestamps flow from a{" "}
                <span className="font-mono text-xs">FixedRuntimeClock</span>; eventIds
                from a seeded <span className="font-mono text-xs">RandomSource</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                  <span>eventId (seeded UUID)</span>
                  <span className="text-right">eventType</span>
                  <span className="text-right">version</span>
                </div>
                <Separator />
                {demo.events.map((e) => (
                  <div
                    key={e.eventId}
                    className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 text-xs items-center hover:bg-muted/30"
                  >
                    <Monospace>{e.eventId}</Monospace>
                    <span className="font-mono text-right text-foreground">{e.eventType}</span>
                    <span className="font-mono text-right text-muted-foreground tabular-nums">
                      v{e.version}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className={`rounded-lg border p-4 ${
                  demo.determinism.identical
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className={
                      demo.determinism.identical
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        : "border-destructive/40 text-destructive"
                    }
                  >
                    {demo.determinism.identical ? "REPLAY INVARIANT HOLDS" : "INVARIANT BROKEN"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    seed = {demo.determinism.seed}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A second <span className="font-mono">SeededRandomSource({demo.determinism.seed})</span>{" "}
                  reproduces the identical UUID sequence. Same inputs → same outputs. This
                  is what makes kernel execution replayable and simulations reproducible
                  (ADR-0002). <span className="font-mono">Date.now()</span> /{" "}
                  <span className="font-mono">Math.random()</span> are forbidden in the
                  deterministic core — the only <span className="font-mono">Date.now()</span>{" "}
                  call in the entire kernel lives in{" "}
                  <span className="font-mono">SystemRuntimeClock</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Projection + Policy side by side */}
        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CQRS Read Side — Projection</CardTitle>
              <CardDescription>
                A pure <span className="font-mono text-xs">(event, state) → state</span>{" "}
                projection derives a read model. Read models are never mutated by query
                code; rebuilt only by replaying events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Projection: <span className="font-mono text-foreground">{demo.projection.name}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(demo.projection.state).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="font-mono">
                    {k} <span className="ml-1 tabular-nums">{v}</span>
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Replaying the same three events through this projection always
                produces this exact state.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Policy Decision</CardTitle>
              <CardDescription>
                A serializable <span className="font-mono text-xs">PredicateSpec</span>{" "}
                rule evaluated by the PolicyEngine into a Decision with provenance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">outcome</span>
                <Badge variant={outcomeVariant(demo.decision.outcome)} className="font-mono uppercase">
                  {demo.decision.outcome}
                </Badge>
              </div>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-muted-foreground">rule: </span>
                  <span className="font-mono">{demo.decision.matchedRules.join(", ")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">decisionId: </span>
                  <Monospace>{demo.decision.decisionId}</Monospace>
                </div>
                <div>
                  <span className="text-muted-foreground">provenance: </span>
                  <span className="font-mono">
                    inputHash={demo.decision.inputHash ?? "—"}, sources={demo.decision.sourceEventCount}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t pt-2">
                {demo.decision.rationale}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Extension host */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">Extension Host</h2>
            <span className="text-xs text-muted-foreground">
              Protocol host · ADR-0006 · no protocol plugins ship in M1
            </span>
          </div>
          <Card>
            <CardContent className="pt-2 space-y-4">
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Installed plugins</div>
                {demo.extension.plugins.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="font-mono">
                      {p.id}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">v{p.version}</span>
                    <span className="text-foreground">{p.name}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Registered descriptors (via ExtensionHost)
                </div>
                <div className="flex flex-wrap gap-2">
                  {demo.extension.registrationKinds.map((k) => (
                    <Badge key={k.kind} variant="secondary" className="font-mono">
                      {k.kind} <span className="ml-1 tabular-nums">{k.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Modules */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Kernel Modules</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {demo.modules.map((m) => (
              <Card key={m.name} className="py-4">
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-medium">{m.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${layerColor(m.layer)}`}>
                      {m.layer}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
                  <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t">
                    deps: {m.dependsOn}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Primitives */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">Canonical Primitives</h2>
            <span className="text-xs text-muted-foreground">
              The only domain concepts the kernel knows
            </span>
          </div>
          <Card>
            <CardContent className="pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {demo.primitives.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="font-mono text-xs font-medium">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.owner}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Architecture invariants */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Architecture Invariants</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "Deterministic Runtime", d: "All time from RuntimeClock; all randomness from seeded RandomSource. No hidden mutable state." },
              { t: "Event Sourcing", d: "Aggregates emit immutable events; state is derived by replay. Snapshots are an optimization only." },
              { t: "CQRS", d: "Commands flow through event-sourced aggregates; queries read projections only and never mutate them." },
              { t: "Clean Architecture", d: "Each module: domain / application / infrastructure / interfaces. Dependency direction strictly inward." },
              { t: "Serializable Policies", d: "Rules use PredicateSpec data, not JS functions — replayable, transportable, auditable." },
              { t: "Protocols as Plugins", d: "Industry behavior installs via the ExtensionHost. The kernel ships host + registry only." },
            ].map((i) => (
              <Card key={i.t} className="py-4">
                <CardContent className="space-y-1.5">
                  <div className="text-sm font-medium">{i.t}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{i.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Dependency direction */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Dependency Direction</h2>
          <Card>
            <CardContent className="pt-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                {["shared-kernel", "events / observability / config", "runtime", "identity → organizations", "projections · policy · scheduling", "extension (host)"].map(
                  (node, i, arr) => (
                    <div key={node} className="flex items-center gap-2">
                      <span className="rounded-md border bg-muted/40 px-2.5 py-1">{node}</span>
                      {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                    </div>
                  )
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Dependencies point inward and downward only. <span className="font-mono">domain/</span>{" "}
                depends on <span className="font-mono">@kernel/shared-kernel</span> alone.
                <span className="font-mono"> infrastructure/</span> is excluded from public barrels
                (dependency inversion).
              </p>
            </CardContent>
          </Card>
        </section>

        {/* What this milestone does NOT build */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Explicitly Not Built (M1)</h2>
          <Card>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-2">
                {[
                  "business logic",
                  "protocols / applications",
                  "REST APIs",
                  "Prisma / DB persistence",
                  "auth UI",
                  "scheduling algorithms",
                  "marketplace / payments",
                  "industry-specific fields",
                ].map((x) => (
                  <Badge key={x} variant="outline" className="text-muted-foreground line-through">
                    {x}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer (sticky to bottom) */}
      <footer className="mt-auto border-t bg-muted/30">
        <div className="container mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            <span className="font-mono text-foreground">OpsOS</span> · Kernel Foundation · Milestone 1
          </div>
          <div className="flex items-center gap-3">
            <span>No business logic. No protocols. Kernel only.</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {demo.modules.length} modules · {demo.primitives.length} primitives
            </Badge>
          </div>
        </div>
      </footer>
    </div>
  );
}
