import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { GenerationWorkspace } from "@/components/workspace/generation-workspace";
import { ECOM_MODULES } from "@/lib/modules/registry";

export default function EcomVideoPresetPage({
  params,
}: {
  params: { preset: string };
}) {
  if (params.preset === "outfit") {
    redirect("/ecom/outfit-video");
  }
  const mod = ECOM_MODULES.find((m) => m.href === `/ecom/video/${params.preset}`);
  if (!mod) notFound();
  return <GenerationWorkspace module={mod} />;
}
