import { EcomAppShell } from "@/components/layout/ecom-app-shell";
import { getEcomShellUser } from "@/lib/ecom-session.server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export async function EcomShell({ children }: { children: React.ReactNode }) {
  const [user, bookOrigin] = await Promise.all([
    getEcomShellUser(),
    Promise.resolve(getMainSiteOrigin() ?? "http://localhost:3000"),
  ]);
  return (
    <EcomAppShell user={user} bookOrigin={bookOrigin}>
      {children}
    </EcomAppShell>
  );
}
