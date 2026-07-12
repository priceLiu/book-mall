import { redirect } from "next/navigation";
import { EcomLoginForm } from "@/components/auth/ecom-login-form";
import { getEcomShellUser } from "@/lib/ecom-session.server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "登录",
  description: "登录电商工具箱，生成主图、详情、带货视频与品牌 VI。",
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
  const user = await getEcomShellUser();
  if (user) redirect(target);

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center bg-white px-4 py-12">
      <EcomLoginForm bookOrigin={getMainSiteOrigin()} redirect={target} />
    </main>
  );
}
