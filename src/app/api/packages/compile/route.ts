import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";
import { compileProtocol } from "@kernel/composition";
import { demoProtocol } from "@kernel/protocol-sdk";

export async function POST() {
  const rt = getKernelRuntime();
  const now = rt.clock.now();

  const result = await compileProtocol(
    {
      protocolManifest: demoProtocol.manifest,
      knowledgeRefs: [],
      contributions: {
        domainBindings: {},
        knowledgeRefs: [],
        compilerExtensions: rt.protocolRegistry.compilerExtensions.list().map((s) => s.name),
        policies: rt.protocolRegistry.policy.listPolicies().map((p) => String(p.id)),
        capabilities: rt.protocolRegistry.capabilities.list().map((c) => String(c.id)),
        workflows: rt.protocolRegistry.workflows.list().map((w) => w.id),
        resourceRequirements: [],
        measurements: [],
        uiExtensions: [],
        apiRoutes: [],
        analytics: [],
        configDefaults: {},
      },
      now,
    },
    { pipeline: rt.composition.pipeline }
  );

  let installResult: { ok: boolean } | null = null;
  if (result.ok && result.package) {
    installResult = await rt.composition.installer.install(result.package);
    if (installResult && installResult.ok && result.package) {
      rt.composition.installer.activate(
        result.package.manifest.id,
        result.package.manifest.version
      );
    }
  }

  return NextResponse.json({
    compiled: result.ok,
    packageId: result.package?.manifest.id,
    version: result.package?.manifest.version,
    digest: result.package?.digest.hash,
    signed: !!result.package?.signature,
    installed: installResult?.ok ?? false,
    stages: result.stages.map((s) => ({ stage: s.stage, ok: s.ok })),
    diagnostics: result.diagnostics.slice(0, 10),
  });
}
