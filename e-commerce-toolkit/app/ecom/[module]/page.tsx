import { notFound, redirect } from "next/navigation";
import { GenerationWorkspace } from "@/components/workspace/generation-workspace";
import { ECOM_MODULES } from "@/lib/modules/registry";

export default function EcomModulePage({
  params,
}: {
  params: { module: string };
}) {
  if (params.module === "seed-video") {
    redirect("/ecom/seed-video");
  }
  if (params.module === "media-decompose") {
    redirect("/ecom/media-decompose");
  }

  const mod = ECOM_MODULES.find(
    (m) => m.href === `/ecom/${params.module}` && m.kind !== "video",
  );
  if (!mod || mod.href.startsWith("/ecom/video")) {
    notFound();
  }
  return <GenerationWorkspace module={mod} />;
}
