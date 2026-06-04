import { notFound } from "next/navigation";
import { GenerationWorkspace } from "@/components/workspace/generation-workspace";
import { ECOM_MODULES } from "@/lib/modules/registry";

export default function BrandModulePage({
  params,
}: {
  params: { module: string };
}) {
  const mod = ECOM_MODULES.find((m) => m.href === `/brand/${params.module}`);
  if (!mod) notFound();
  return <GenerationWorkspace module={mod} />;
}
