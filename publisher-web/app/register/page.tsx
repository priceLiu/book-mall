import { redirect } from "next/navigation";
import { getPublisherToolsToken } from "@/lib/publisher-session.server";
import { publisherRegisterHref } from "@/lib/portal-auth-links";

export const dynamic = "force-dynamic";

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
  const token = await getPublisherToolsToken();
  if (token) redirect(target);
  redirect(publisherRegisterHref(target));
}
