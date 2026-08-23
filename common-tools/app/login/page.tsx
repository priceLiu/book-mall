import { redirect } from "next/navigation";

import { CtLoginForm } from "@/components/auth/ct-login-form";
import { getShellUser } from "@/lib/session.server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "登录",
  description: "登录常用工具，使用 AI 图像小工具与修图能力。",
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
  const user = await getShellUser();
  if (user) redirect(target);

  return (
    <div className="flex justify-center py-10">
      <CtLoginForm bookOrigin={getMainSiteOrigin()} redirect={target} />
    </div>
  );
}
