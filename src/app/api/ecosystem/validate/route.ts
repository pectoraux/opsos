import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rt = getKernelRuntime();

    const result = rt.ecosystemConformance.validate({
      packageId: body.packageId || "opsos.protocol.demo",
      packageVersion: body.packageVersion || "1.0.0",
      kernelVersionRange: body.kernelVersionRange || "^1.0.0",
      manifestValid: body.manifestValid ?? true,
      signatureValid: body.signatureValid ?? true,
      domainCount: body.domainCount ?? 1,
      capabilityCount: body.capabilityCount ?? 1,
      intentTypeCount: body.intentTypeCount ?? 1,
      workflowCount: body.workflowCount ?? 1,
      policyCount: body.policyCount ?? 1,
      knowledgeCount: body.knowledgeCount ?? 1,
      aiRoleCount: body.aiRoleCount ?? 1,
      experienceCount: body.experienceCount ?? 1,
      communicationTemplateCount: body.communicationTemplateCount ?? 1,
      integrationCount: body.integrationCount ?? 1,
      permissionCount: body.permissionCount ?? 1,
      telemetryCount: body.telemetryCount ?? 1,
      twinEnabledCount: body.twinEnabledCount ?? 1,
      governanceRuleCount: body.governanceRuleCount ?? 1,
      kernelConformancePassed: body.kernelConformancePassed ?? true,
      sdkOnlyImports: body.sdkOnlyImports ?? true,
      noPlatformInternals: body.noPlatformInternals ?? true,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
