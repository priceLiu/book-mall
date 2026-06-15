import { InviteLayoutShell } from "@/components/layout/invite-layout-shell";
import { InviteNavAuth } from "@/components/layout/invite-nav-auth";
import { InviteAnonymousSessionProvider } from "@/components/providers/invite-anonymous-session-provider";
import "../site-home.css";

export const dynamic = "force-dynamic";

export default function InviteRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <InviteAnonymousSessionProvider>
      <InviteLayoutShell navAuth={<InviteNavAuth />}>{children}</InviteLayoutShell>
    </InviteAnonymousSessionProvider>
  );
}
