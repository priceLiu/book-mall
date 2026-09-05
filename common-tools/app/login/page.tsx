import { redirect } from "next/navigation";
import { buildLoginUrl } from "@/lib/portal-auth-links";
import { getShellUser } from "@/lib/session.server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "登录",
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
  redirect(buildLoginUrl(target));
}
