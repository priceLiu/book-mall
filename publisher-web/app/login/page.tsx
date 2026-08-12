import { redirect } from "next/navigation";
import { PublisherLoginForm } from "@/components/auth/publisher-login-form";
import { getPublisherToolsToken } from "@/lib/publisher-session.server";
import { getMainSiteOrigin } from "@/lib/site-origin";

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
  const loopback = Array.isArray(searchParams?.loopback)
    ? searchParams?.loopback[0]
    : searchParams?.loopback;
  const token = await getPublisherToolsToken();
  if (token && !client) redirect(target);
  if (token && client) redirect(`/auth/client-callback?client=${client}`);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <PublisherLoginForm
        bookOrigin={getMainSiteOrigin()}
        redirect={target}
        client={client}
        loopback={loopback}
      />
    </main>
  );
}
