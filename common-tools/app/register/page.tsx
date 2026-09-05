import { redirect } from "next/navigation";
import { buildRegisterUrl } from "@/lib/portal-auth-links";
import { getShellUser } from "@/lib/session.server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "注册",
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
  redirect(buildRegisterUrl(target));
}
