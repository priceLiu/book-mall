import { redirect } from "next/navigation";

import { CtRegisterForm } from "@/components/auth/ct-register-form";
import { getShellUser } from "@/lib/session.server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "注册",
  description: "注册常用工具，领取体验积分。",
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
  const user = await getShellUser();
  if (user) redirect(target);

  return (
    <div className="flex justify-center py-10">
      <CtRegisterForm bookOrigin={getMainSiteOrigin()} redirect={target} />
    </div>
  );
}
