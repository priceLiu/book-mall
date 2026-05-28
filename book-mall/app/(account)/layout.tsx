import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembershipFlags } from "@/lib/membership";
import { userHasAnyActiveToolService } from "@/lib/tool-service-fee/periods";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import { AccountShell } from "@/components/account/account-shell";

/** Layout 内查询 Prisma；构建阶段 CI 往往无 DATABASE_URL */
export const dynamic = "force-dynamic";

export default async function AccountGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [profile, flags, hasToolService] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true, name: true, email: true },
    }),
    getMembershipFlags(session.user.id),
    userHasAnyActiveToolService(session.user.id),
  ]);

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdminUser = session.user.role === "ADMIN";
  const canLaunchTools =
    toolsSsoReady && (isAdminUser || hasToolService);

  const showCoursesCta =
    flags.hasActiveSubscription || flags.hasActiveCourseProductSubscription;
  const showToolsCta = canLaunchTools;

  return (
    <AccountShell
      profile={{
        image: profile?.image ?? session.user.image ?? null,
        name: profile?.name ?? session.user.name ?? null,
        email: profile?.email ?? session.user.email ?? null,
      }}
      isAdmin={session.user.role === "ADMIN"}
      showCoursesCta={showCoursesCta}
      showToolsCta={showToolsCta}
      canLaunchTools={canLaunchTools}
    >
      {children}
    </AccountShell>
  );
}
