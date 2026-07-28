import { NextResponse } from "next/server";
import { getKernelRuntime } from "@/lib/kernel-runtime";
import { REFERENCE_SCENARIOS } from "@kernel/conformance";

export async function POST() {
  const rt = getKernelRuntime();
  const result = rt.conformanceEngine.runSuite(REFERENCE_SCENARIOS);
  return NextResponse.json({
    total: result.total,
    passed: result.passed,
    failed: result.failed,
    deterministicChecksum: result.deterministicChecksum,
    scenarios: result.results.map((r) => ({
      id: r.scenarioId,
      name: r.scenarioName,
      passed: r.passed,
      replayVerified: r.replayVerified,
      assertionsPassed: r.assertions.filter((a) => a.passed).length,
      assertionsTotal: r.assertions.length,
      eventCount: r.metrics.eventCount,
      durationMs: r.durationMs,
    })),
  });
}
