import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CanvasRegisterForm } from "@/components/auth/canvas-register-form";
import { fetchToolsSession } from "@/lib/tools-introspect";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "注册",
  description: "注册 canvas-web AI 海报画布，免费开始可视化节点创作。",
};

function safeRedirect(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/projects";
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const target = safeRedirect(searchParams?.redirect);
  const token = cookies().get("tools_token")?.value;
  const session = await fetchToolsSession(token);
  if (session.active) redirect(target);

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-4 py-12">
      <CanvasRegisterForm bookOrigin={getMainSiteOrigin()} redirect={target} />
    </main>
  );
}
