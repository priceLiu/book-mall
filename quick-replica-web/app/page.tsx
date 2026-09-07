import { cookies } from "next/headers";

import { QrAppClient } from "@/components/quick-replica/qr-app-client";
import { QrLanding } from "@/components/qr-landing";
import { QrInactiveSessionRecover } from "@/components/qr-inactive-session-recover";
import { fetchToolsSession } from "@/lib/tools-introspect";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

async function fetchCanManageFeatured(token: string | undefined): Promise<boolean> {
  const origin = getMainSiteOrigin();
  if (!origin || !token?.trim()) return false;
  try {
    const res = await fetch(`${origin}/api/platform/v1/quick-replica/session`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { canManageFeatured?: boolean };
    return data.canManageFeatured === true;
  } catch {
    return false;
  }
}

export default async function HomePage() {
  const token = cookies().get("tools_token")?.value?.trim() ?? "";
  const session = await fetchToolsSession(token || undefined);
  if (session.active) {
    const intro = session.introspect;
    const canManageFeatured = await fetchCanManageFeatured(token);
    const mainOrigin = getMainSiteOrigin();
    const bookMallAdminUrl = mainOrigin
      ? `${mainOrigin}/admin/templates?tab=quick-replica`
      : null;

    return (
      <QrAppClient
        canManageFeatured={canManageFeatured}
        bookMallAdminUrl={bookMallAdminUrl}
        session={
          intro
            ? {
                name: typeof intro.name === "string" ? intro.name : null,
                email: typeof intro.email === "string" ? intro.email : null,
                phone: typeof intro.phone === "string" ? intro.phone : null,
              }
            : null
        }
      />
    );
  }

  // 有 token 但 introspect 未 active：续签 / re-enter，勿误展示落地页
  if (token) {
    return (
      <main className="flex h-dvh flex-col bg-[var(--qr-bg-page)]">
        <QrInactiveSessionRecover />
      </main>
    );
  }

  return <QrLanding />;
}
