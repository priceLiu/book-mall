import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import {
  getEcommerceWebOrigin,
  getCommonToolsOrigin,
  getQuickReplicaOrigin,
  getPublisherWebOrigin,
} from "@/lib/app-web-origins";
import { AccountAppShell } from "@/components/account/account-app-shell";
import { AccountShellLoader } from "@/components/account/account-shell-loader";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { runDbQuery } from "@/lib/db-query";
import "../site-home.css";

/** Layout 内查询 Prisma；构建阶段 CI 往往无 DATABASE_URL */
export const dynamic = "force-dynamic";

type AccountLayoutUser = {
  image: string | null;
  name: string | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  billingPersona: import("@prisma/client").BillingPersona | null;
  billingPersonaLockedAt: Date | null;
};

async function loadAccountLayoutUser(userId: string): Promise<AccountLayoutUser | null> {
  return runDbQuery<AccountLayoutUser | null>(
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

      return userRecord;
    },
    null,
  );
}

export default async function AccountGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userRecord = await loadAccountLayoutUser(session.user.id);

  if (!userRecord) {
    return (
      <AccountAppShell navAuth={<NavbarAuth appearance="default" />}>
        <div className="px-4 py-8 text-sm text-muted-foreground md:px-8">
          个人中心暂时不可用，请稍后刷新。
        </div>
      </AccountAppShell>
    );
  }

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdmin = session.user.role === "ADMIN";
  const billingPersona = userRecord.billingPersona ?? null;

  return (
    <AccountAppShell navAuth={<NavbarAuth appearance="default" />}>
      <AccountShellLoader
        profile={{
          image: userRecord.image ?? session.user.image ?? null,
          name: userRecord.name ?? session.user.name ?? null,
          phone: userRecord.phone ?? session.user.phone ?? null,
        }}
        isAdmin={isAdmin}
        billingPersona={billingPersona}
        env={{
          toolsSsoReady,
          ecomOriginConfigured: Boolean(getEcommerceWebOrigin().startsWith("http")),
          quickReplicaOriginConfigured: Boolean(getQuickReplicaOrigin().startsWith("http")),
          commonToolsOriginConfigured: Boolean(getCommonToolsOrigin().startsWith("http")),
          publisherOriginConfigured: Boolean(getPublisherWebOrigin().startsWith("http")),
        }}
      >
        {children}
      </AccountShellLoader>
    </AccountAppShell>
  );
}
