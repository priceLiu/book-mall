import { EcomMobileBar } from "@/components/layout/ecom-mobile-bar";
import { EcomProfileSidebar } from "@/components/layout/ecom-profile-sidebar";
import { getEcomShellUser } from "@/lib/ecom-session.server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export async function EcomShell({ children }: { children: React.ReactNode }) {
  const [user, bookOrigin] = await Promise.all([
    getEcomShellUser(),
    Promise.resolve(getMainSiteOrigin() ?? "http://localhost:3000"),
  ]);
  return (
    <div className="flex h-dvh gap-4 overflow-hidden bg-[#0c0c0e] p-4 md:p-5">
      <EcomProfileSidebar
        user={user}
        bookOrigin={bookOrigin}
        className="hidden h-full md:flex"
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-[var(--ecom-parchment)] shadow-inner">
        <EcomMobileBar />
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
