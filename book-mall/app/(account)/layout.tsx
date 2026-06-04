import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasAnyActiveToolService } from "@/lib/tool-service-fee/periods";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import { getGatewayLinkStatusForUser } from "@/lib/canvas/book-gateway-link";
import { getCanvasWebOrigin, getEcommerceWebOrigin } from "@/lib/app-web-origins";
import { userCanAccessEcommerceToolkit } from "@/lib/ecom/ecom-access";
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

  const [profile, hasToolService, gatewayStatus, ecomAccess] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true, name: true, email: true },
    }),
    userHasAnyActiveToolService(session.user.id),
    getGatewayLinkStatusForUser(session.user.id),
    userCanAccessEcommerceToolkit(session.user.id),
  ]);

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdminUser = session.user.role === "ADMIN";
  const canLaunchTools =
    toolsSsoReady && (isAdminUser || hasToolService);
  const canLaunchCanvas = canLaunchTools;
  const canvasOriginConfigured = Boolean(getCanvasWebOrigin().startsWith("http"));
  const ecomOriginConfigured = Boolean(getEcommerceWebOrigin().startsWith("http"));
  const canLaunchEcommerce = toolsSsoReady && (isAdminUser || ecomAccess);

  const showToolsCta = toolsSsoReady;

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
    >
      {children}
    </AccountShell>
  );
}
