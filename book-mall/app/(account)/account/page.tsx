import { AlertTriangle } from "lucide-react";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AccountOverviewSection } from "@/components/account/account-overview-section";
import { AccountDevActions } from "@/components/account/account-dev-actions";

export const metadata = {
  title: "概览 — 个人中心",
};

function toolsSsoErrBanner(code: string): { title: string; body: string } | null {
  switch (code) {
    case "TOOLS_ACCESS_DENIED":
      return {
        title: "未能打开 AI 工具站",
        body:
          "当前账号不满足工具站准入：须为主站管理员，或持有有效会员套餐（个人或团队）。请在「会员套餐」页选购。",
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

export default function AccountPage({
  searchParams,
}: {
  searchParams?: { tools_sso_err?: string };
}) {
  const toolsSsoErr =
    typeof searchParams?.tools_sso_err === "string"
      ? searchParams.tools_sso_err.trim()
      : "";
  const toolsBanner =
    toolsSsoErr.length > 0 ? toolsSsoErrBanner(toolsSsoErr) : null;

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
        description="积分、计费身份与套餐状态一览；其它模块请用左侧菜单切换。"
      />

      <AccountOverviewSection />

      {process.env.NODE_ENV === "development" ? (
        <section className="mt-8">
          <AccountDevActions />
        </section>
      ) : null}
    </>
  );
}
