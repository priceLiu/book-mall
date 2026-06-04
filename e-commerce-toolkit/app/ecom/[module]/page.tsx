import { notFound } from "next/navigation";
import { GenerationWorkspace } from "@/components/workspace/generation-workspace";
import { ECOM_MODULES } from "@/lib/modules/registry";

export default function EcomModulePage({
  params,
}: {
  params: { module: string };
}) {
  const mod = ECOM_MODULES.find(
    (m) => m.href === `/ecom/${params.module}` && m.kind !== "video",
  );
  if (!mod || mod.href.startsWith("/ecom/video")) {
    notFound();
  }
  return <GenerationWorkspace module={mod} />;
}
