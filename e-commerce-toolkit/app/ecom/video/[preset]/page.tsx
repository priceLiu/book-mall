import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { GenerationWorkspace } from "@/components/workspace/generation-workspace";
import { SimpleFusionVideoStudio } from "@/components/simple-fusion-video/simple-fusion-video-studio";
import { ECOM_MODULES } from "@/lib/modules/registry";

const SIMPLE_FUSION_PRESETS: Record<string, string> = {
  camera: "video-camera",
  "mirror-selfie": "video-mirror-selfie",
  "dance-swap": "video-dance-swap",
};

export default function EcomVideoPresetPage({
  params,
}: {
  params: { preset: string };
}) {
  if (params.preset === "outfit") {
    redirect("/ecom/outfit-video");
  }
  const simpleModule = SIMPLE_FUSION_PRESETS[params.preset];
  if (simpleModule) {
    return <SimpleFusionVideoStudio moduleId={simpleModule} />;
  }
  const mod = ECOM_MODULES.find((m) => m.href === `/ecom/video/${params.preset}`);
  if (!mod) notFound();
  return <GenerationWorkspace module={mod} />;
}
