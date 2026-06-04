import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getMembershipFlags } from "@/lib/membership";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { userHasAnyActiveToolService } from "@/lib/tool-service-fee/periods";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import { getGatewayLinkStatusForUser } from "@/lib/canvas/book-gateway-link";
import { getCanvasWebOrigin } from "@/lib/app-web-origins";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AccountOverviewCards } from "@/components/account/account-overview-cards";
import { AccountDevActions } from "@/components/account/account-dev-actions";
import { accountInlineLinkClass } from "@/components/account/account-nav-styles";
import { hrefPricingDisclosureFromAccount } from "@/lib/pricing-disclosure-view";

export const metadata = {
  title: "概览 — 个人中心",
};

function toolsSsoErrBanner(code: string): { title: string; body: string } | null {
  switch (code) {
    case "TOOLS_ACCESS_DENIED":
      return {
        title: "未能打开 AI 工具站",
        body:
          "当前账号不满足工具站准入：须为主站管理员，或至少开通一项有效的工具技术服务费。请在侧栏「工具技术服务费」开通。",
      };
    case "SSO_CODE_PERSIST_FAILED":
      return {
        title: "工具站签发失败（数据库）",
        body: "请在 book-mall 执行 `pnpm run db:deploy` 后重启主站，再试。",
      };
    case "TOOLS_SSO_SECRETS_MISSING":
    case "TOOLS_PUBLIC_ORIGIN_INVALID":
    case "TOOLS_SSO_UNAVAILABLE":
      return {
        title: "工具站 SSO 未就绪",
        body: "请检查 TOOLS_PUBLIC_ORIGIN、TOOLS_SSO_* 环境变量。",
      };
    default:
      return {
        title: "工具站跳转未完成",
        body: `服务端返回「${code}」。请稍后从侧栏重新打开应用。`,
      };
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: { tools_sso_err?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const toolsSsoErr =
    typeof searchParams?.tools_sso_err === "string"
      ? searchParams.tools_sso_err.trim()
      : "";
  const toolsBanner =
    toolsSsoErr.length > 0 ? toolsSsoErrBanner(toolsSsoErr) : null;

  const [flags, goldAccess, hasToolService, gatewayStatus] = await Promise.all([
    getMembershipFlags(session.user.id),
    getGoldMemberAccess(session.user.id),
    userHasAnyActiveToolService(session.user.id),
    getGatewayLinkStatusForUser(session.user.id),
  ]);

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdminUser = session.user.role === "ADMIN";
  const canLaunchTools =
    toolsSsoReady && (isAdminUser || hasToolService);
  const canLaunchCanvas = canLaunchTools;
  const canvasOriginConfigured = Boolean(getCanvasWebOrigin().startsWith("http"));

  return (
    <>
      {toolsBanner ? (
        <div
          role="alert"
          className="mb-6 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold text-destructive">{toolsBanner.title}</p>
            <p className="leading-relaxed text-muted-foreground">{toolsBanner.body}</p>
          </div>
        </div>
      ) : null}

      <AccountSectionHeader
        title="概览"
        description={
          <>
            钱包、订阅与工具准入一览。计费细则与提现说明见{" "}
            <a
              href={hrefPricingDisclosureFromAccount({ hash: "billing-policy" })}
              className={accountInlineLinkClass()}
            >
              公示
            </a>
            ；其它模块请用左侧菜单切换。
          </>
        }
      />

      <AccountOverviewCards
        balancePoints={flags.balancePoints}
        minBalanceLinePoints={flags.minBalanceLinePoints}
        canUsePremiumMetered={flags.canUsePremiumMetered}
        hasActiveSubscription={flags.hasActiveSubscription}
        membershipPlanName={flags.membershipPlanName}
        subscriptionEndsAt={flags.subscriptionEndsAt}
        hasActiveToolProductSubscription={flags.hasActiveToolProductSubscription}
        goldIsActive={goldAccess.isGoldMember}
        goldMinBalanceLinePoints={goldAccess.minBalanceLinePoints}
        goldHasRechargeHistory={goldAccess.hasRechargeHistory}
        hasActiveToolService={hasToolService}
        canLaunchTools={canLaunchTools}
        showToolsCta={toolsSsoReady}
        gatewayLinked={gatewayStatus.linked}
        canLaunchCanvas={canLaunchCanvas}
        canvasOriginConfigured={canvasOriginConfigured}
      />

      {process.env.NODE_ENV === "development" ? (
        <section className="mt-8">
          <AccountDevActions />
        </section>
      ) : null}
    </>
  );
}
