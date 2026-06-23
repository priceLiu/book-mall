import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasMembershipToolAccess } from "@/lib/membership-tool-access";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import { prepareAccountCanvasLaunch } from "@/lib/account-canvas-launch";
import { buildAccountAppsMenuHint } from "@/lib/account-apps-menu-hint";
import { getEcommerceWebOrigin, getQuickReplicaOrigin } from "@/lib/app-web-origins";
import { userCanAccessEcommerceToolkit } from "@/lib/ecom/ecom-access";
import { AccountShell } from "@/components/account/account-shell";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { SiteAppShell } from "@/components/layout/site-home/site-app-shell";
import "../site-home.css";

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
      phone: true,
      phoneVerifiedAt: true,
      billingPersona: true,
      billingPersonaLockedAt: true,
    },
  });

  if (!userRecord?.phoneVerifiedAt) {
    redirect("/onboarding/bind-phone");
  }

  if (!userRecord?.billingPersonaLockedAt) {
    redirect("/onboarding/billing-persona");
  }

  const [profile, hasMembership, canvasLaunch, ecomAccess] = await Promise.all([
    Promise.resolve(userRecord),
    userHasMembershipToolAccess(session.user.id),
    prepareAccountCanvasLaunch(session.user.id),
    userCanAccessEcommerceToolkit(session.user.id),
  ]);

  const toolsSsoReady = isToolsSsoConfigured();
  const canLaunchTools = toolsSsoReady && hasMembership;
  const canLaunchCanvas = canLaunchTools;
  const { gatewayLinked, canvasOriginConfigured } = canvasLaunch;
  const ecomOriginConfigured = Boolean(getEcommerceWebOrigin().startsWith("http"));
  const quickReplicaOriginConfigured = Boolean(getQuickReplicaOrigin().startsWith("http"));
  const canLaunchEcommerce = toolsSsoReady && ecomAccess;
  const canLaunchQuickReplica = canLaunchTools;

  const showToolsCta = toolsSsoReady;
  const appsMenuHint = buildAccountAppsMenuHint({
    toolsSsoReady,
    hasToolService: hasMembership,
    gatewayLinked,
    canvasOriginConfigured,
    canLaunchCanvas,
    ecomAccess,
    ecomOriginConfigured,
    quickReplicaOriginConfigured,
    canLaunchQuickReplica,
    isAdmin: session.user.role === "ADMIN",
    billingPersona: userRecord.billingPersona,
  });

  return (
    <SiteAppShell
      isLoggedIn
      navAuth={<NavbarAuth appearance="site-home" />}
    >
      <AccountShell
        profile={{
          image: profile?.image ?? session.user.image ?? null,
          name: profile?.name ?? session.user.name ?? null,
          phone: profile?.phone ?? session.user.phone ?? null,
        }}
        isAdmin={session.user.role === "ADMIN"}
        showToolsCta={showToolsCta}
        canLaunchTools={canLaunchTools}
        canLaunchCanvas={canLaunchCanvas}
        canvasOriginConfigured={canvasOriginConfigured}
        gatewayLinked={gatewayLinked}
        canLaunchEcommerce={canLaunchEcommerce}
        ecomOriginConfigured={ecomOriginConfigured}
        canLaunchQuickReplica={canLaunchQuickReplica}
        quickReplicaOriginConfigured={quickReplicaOriginConfigured}
        appsMenuHint={appsMenuHint}
        billingPersona={userRecord.billingPersona}
      >
        {children}
      </AccountShell>
    </SiteAppShell>
  );
}
