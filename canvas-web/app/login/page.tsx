import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CanvasLoginForm } from "@/components/auth/canvas-login-form";
import { fetchToolsSession } from "@/lib/tools-introspect";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "登录",
  description: "登录 canvas-web AI 海报画布，拖拽节点让 AI 拼出你的设计稿。",
};

function safeRedirect(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/projects";
}

export default async function LoginPage({
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
      <CanvasLoginForm bookOrigin={getMainSiteOrigin()} redirect={target} />
    </main>
  );
}
