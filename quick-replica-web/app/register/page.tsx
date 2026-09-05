import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { qrRegisterHref } from "@/lib/portal-auth-links";
import { fetchToolsSession } from "@/lib/tools-introspect";

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
  const token = cookies().get("tools_token")?.value;
  const session = await fetchToolsSession(token);
  if (session.active) redirect(target);
  redirect(qrRegisterHref(target));
}
