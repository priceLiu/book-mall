import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getToolsSsoSetupDiagnostics } from "@/lib/sso-tools-env";

import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = {
  title: "管理后台",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/account");

  const toolsSsoDiag = getToolsSsoSetupDiagnostics();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-secondary bg-card/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
        <div className="container flex min-h-14 max-w-screen-xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 mx-auto">
          <Link href="/admin" className="font-semibold text-foreground shrink-0">
            管理后台
          </Link>
          <AdminNav
            user={{
              id: session.user.id,
              email: session.user.email ?? null,
              name: session.user.name ?? null,
              image: session.user.image ?? null,
            }}
            toolsSsoReady={toolsSsoDiag.ready}
            toolsSsoIssues={toolsSsoDiag.issues}
          />
        </div>
      </header>
      <div className="container max-w-screen-xl px-4 py-8 mx-auto">{children}</div>
    </div>
  );
}
