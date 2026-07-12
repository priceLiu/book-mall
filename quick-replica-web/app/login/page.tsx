import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QrLoginForm } from "@/components/auth/qr-login-form";
import { fetchToolsSession } from "@/lib/tools-introspect";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "登录",
  description: "登录快速复制 QuickReplica，按示例快速复制生成视频、图像与场景。",
};

function safeRedirect(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
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
    <main className="flex h-dvh w-full items-center justify-center overflow-y-auto px-4 py-10">
      <QrLoginForm bookOrigin={getMainSiteOrigin()} redirect={target} />
    </main>
  );
}
