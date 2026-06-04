import { notFound } from "next/navigation";
import { GenerationWorkspace } from "@/components/workspace/generation-workspace";
import { ECOM_MODULES } from "@/lib/modules/registry";

export default function EcomVideoPresetPage({
  params,
}: {
  params: { preset: string };
}) {
  const mod = ECOM_MODULES.find((m) => m.href === `/ecom/video/${params.preset}`);
  if (!mod) notFound();
  return <GenerationWorkspace module={mod} />;
}
