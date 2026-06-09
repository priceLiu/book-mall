import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasMembershipToolAccess } from "@/lib/membership-tool-access";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import { getGatewayLinkStatusForUser } from "@/lib/canvas/book-gateway-link";
import { getCanvasWebOrigin, getEcommerceWebOrigin } from "@/lib/app-web-origins";
import { userCanAccessEcommerceToolkit } from "@/lib/ecom/ecom-access";
import { buildAccountAppsMenuHint } from "@/lib/account-apps-menu-hint";
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

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      image: true,
      name: true,
      email: true,
      billingPersona: true,
      billingPersonaLockedAt: true,
    },
  });

  if (!userRecord?.billingPersonaLockedAt) {
    redirect("/onboarding/billing-persona");
  }

  const [profile, hasMembership, gatewayStatus, ecomAccess] = await Promise.all([
    Promise.resolve(userRecord),
    userHasMembershipToolAccess(session.user.id),
    getGatewayLinkStatusForUser(session.user.id),
    userCanAccessEcommerceToolkit(session.user.id),
  ]);

  const toolsSsoReady = isToolsSsoConfigured();
  const canLaunchTools = toolsSsoReady && hasMembership;
  const canLaunchCanvas = canLaunchTools;
  const canvasOriginConfigured = Boolean(getCanvasWebOrigin().startsWith("http"));
  const ecomOriginConfigured = Boolean(getEcommerceWebOrigin().startsWith("http"));
  const canLaunchEcommerce = toolsSsoReady && ecomAccess;

  const showToolsCta = toolsSsoReady;
  const appsMenuHint = buildAccountAppsMenuHint({
    toolsSsoReady,
    hasToolService: hasMembership,
    gatewayLinked: gatewayStatus.linked,
    canvasOriginConfigured,
    ecomAccess,
    ecomOriginConfigured,
    isAdmin: session.user.role === "ADMIN",
  });

  return (
    <AccountShell
      profile={{
        image: profile?.image ?? session.user.image ?? null,
        name: profile?.name ?? session.user.name ?? null,
        email: profile?.email ?? session.user.email ?? null,
      }}
      isAdmin={session.user.role === "ADMIN"}
      showToolsCta={showToolsCta}
      canLaunchTools={canLaunchTools}
      canLaunchCanvas={canLaunchCanvas}
      canvasOriginConfigured={canvasOriginConfigured}
      gatewayLinked={gatewayStatus.linked}
      canLaunchEcommerce={canLaunchEcommerce}
      ecomOriginConfigured={ecomOriginConfigured}
      appsMenuHint={appsMenuHint}
      billingPersona={userRecord.billingPersona}
    >
      {children}
    </AccountShell>
  );
}
