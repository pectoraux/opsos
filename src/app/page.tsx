import { runKernelDemo } from "@/lib/kernel-demo";
import { ControlPlaneClient } from "@/components/control-plane-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const demo = await runKernelDemo();
  return <ControlPlaneClient demo={demo} />;
}
