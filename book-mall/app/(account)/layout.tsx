import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasMembershipToolAccess } from "@/lib/membership-tool-access";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import { prepareAccountCanvasLaunch } from "@/lib/account-canvas-launch";
import { buildAccountAppsMenuHint } from "@/lib/account-apps-menu-hint";
import { getEcommerceWebOrigin, getCommonToolsOrigin, getQuickReplicaOrigin, getPublisherWebOrigin } from "@/lib/app-web-origins";
import { userCanAccessEcommerceToolkit } from "@/lib/ecom/ecom-access";
import { getReferralEligibility } from "@/lib/referral/referral-service";
import { AccountShell } from "@/components/account/account-shell";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { SiteAppShell } from "@/components/layout/site-home/site-app-shell";
import { runDbQuery } from "@/lib/db-query";
import "../site-home.css";

/** Layout 内查询 Prisma；构建阶段 CI 往往无 DATABASE_URL */
export const dynamic = "force-dynamic";

type AccountLayoutData = {
  dbDegraded: boolean;
  userRecord: {
    image: string | null;
    name: string | null;
    phone: string | null;
    phoneVerifiedAt: Date | null;
    billingPersona: import("@prisma/client").BillingPersona | null;
    billingPersonaLockedAt: Date | null;
  } | null;
  hasMembership: boolean;
  canvasLaunch: Awaited<ReturnType<typeof prepareAccountCanvasLaunch>>;
  ecomAccess: boolean;
  referralEligibility: Awaited<ReturnType<typeof getReferralEligibility>>;
};

const EMPTY_CANVAS_LAUNCH: AccountLayoutData["canvasLaunch"] = {
  gatewayLinked: false,
  canvasOriginConfigured: false,
};

async function loadAccountLayoutData(userId: string): Promise<AccountLayoutData> {
  return runDbQuery<AccountLayoutData>(
    "AccountGroupLayout",
    async () => {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
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

      const [hasMembership, canvasLaunch, ecomAccess, referralEligibility] =
        await Promise.all([
          userHasMembershipToolAccess(userId),
          prepareAccountCanvasLaunch(userId),
          userCanAccessEcommerceToolkit(userId),
          getReferralEligibility(userId),
        ]);

      return {
        dbDegraded: false,
        userRecord,
        hasMembership,
        canvasLaunch,
        ecomAccess,
        referralEligibility,
      };
    },
    {
      dbDegraded: true,
      userRecord: null,
      hasMembership: false,
      canvasLaunch: EMPTY_CANVAS_LAUNCH,
      ecomAccess: false,
      referralEligibility: { eligible: false, planLabel: null, reason: null },
    },
  );
}

export default async function AccountGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const layoutData = await loadAccountLayoutData(session.user.id);
  const { dbDegraded, userRecord, hasMembership, canvasLaunch, ecomAccess, referralEligibility } =
    layoutData;

  if (!dbDegraded && userRecord) {
    if (!userRecord.phoneVerifiedAt) redirect("/onboarding/bind-phone");
    if (!userRecord.billingPersonaLockedAt) redirect("/onboarding/billing-persona");
  }

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdmin = session.user.role === "ADMIN";
  const canLaunchTools = !dbDegraded && toolsSsoReady && (isAdmin || hasMembership);
  const canLaunchCanvas = canLaunchTools;
  const { gatewayLinked, canvasOriginConfigured } = canvasLaunch;
  const ecomOriginConfigured = Boolean(getEcommerceWebOrigin().startsWith("http"));
  const quickReplicaOriginConfigured = Boolean(getQuickReplicaOrigin().startsWith("http"));
  const commonToolsOriginConfigured = Boolean(getCommonToolsOrigin().startsWith("http"));
  const publisherOriginConfigured = Boolean(getPublisherWebOrigin().startsWith("http"));
  const canLaunchEcommerce = !dbDegraded && toolsSsoReady && ecomAccess;
  const canLaunchQuickReplica = canLaunchTools;
  const canLaunchCommonTools = canLaunchTools;

  const showToolsCta = toolsSsoReady;
  const billingPersona = userRecord?.billingPersona ?? null;
  const appsMenuHint = dbDegraded
    ? null
    : buildAccountAppsMenuHint({
        toolsSsoReady,
        hasToolService: hasMembership,
        gatewayLinked,
        canvasOriginConfigured,
        canLaunchCanvas,
        ecomAccess,
        ecomOriginConfigured,
        quickReplicaOriginConfigured,
        canLaunchQuickReplica,
        commonToolsOriginConfigured,
        canLaunchCommonTools,
        isAdmin,
        billingPersona,
      });

  return (
    <SiteAppShell
      isLoggedIn
      navAuth={<NavbarAuth appearance="site-home" />}
    >
      <AccountShell
        profile={{
          image: userRecord?.image ?? session.user.image ?? null,
          name: userRecord?.name ?? session.user.name ?? null,
          phone: userRecord?.phone ?? session.user.phone ?? null,
        }}
        isAdmin={isAdmin}
        showToolsCta={showToolsCta}
        canLaunchTools={canLaunchTools}
        canLaunchCanvas={canLaunchCanvas}
        canvasOriginConfigured={canvasOriginConfigured}
        gatewayLinked={gatewayLinked}
        canLaunchEcommerce={canLaunchEcommerce}
        ecomOriginConfigured={ecomOriginConfigured}
        canLaunchQuickReplica={canLaunchQuickReplica}
        quickReplicaOriginConfigured={quickReplicaOriginConfigured}
        canLaunchCommonTools={canLaunchCommonTools}
        commonToolsOriginConfigured={commonToolsOriginConfigured}
        publisherOriginConfigured={publisherOriginConfigured}
        appsMenuHint={appsMenuHint}
        billingPersona={billingPersona}
        showReferral={!dbDegraded && referralEligibility.eligible}
      >
        {children}
      </AccountShell>
    </SiteAppShell>
  );
}
