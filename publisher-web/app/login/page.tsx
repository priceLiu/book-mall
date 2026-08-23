import { redirect } from "next/navigation";
import { getPublisherToolsToken } from "@/lib/publisher-session.server";
import { publisherLoginHref } from "@/lib/portal-auth-links";

export const dynamic = "force-dynamic";

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
  const client = Array.isArray(searchParams?.client)
    ? searchParams?.client[0]
    : searchParams?.client;
  const token = await getPublisherToolsToken();
  if (token && !client) redirect(target);
  if (token && client) redirect(`/auth/client-callback?client=${client}`);

  const redirectPath = client
    ? `/login?client=${encodeURIComponent(client)}`
    : target;
  redirect(publisherLoginHref(redirectPath));
}
