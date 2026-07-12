import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QrRegisterForm } from "@/components/auth/qr-register-form";
import { fetchToolsSession } from "@/lib/tools-introspect";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "注册",
  description: "注册快速复制 QuickReplica，免费开始按示例复制生成视频、图像与场景。",
};

function safeRedirect(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
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
    <main className="flex h-dvh w-full items-center justify-center overflow-y-auto px-4 py-10">
      <QrRegisterForm bookOrigin={getMainSiteOrigin()} redirect={target} />
    </main>
  );
}
