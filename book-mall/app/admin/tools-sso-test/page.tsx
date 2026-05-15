import { ToolsSsoTestClient } from "@/components/admin/tools-sso-test-client";
import { getToolsPublicOrigin, getToolsSsoSetupDiagnostics } from "@/lib/sso-tools-env";

export const metadata = {
  title: "工具站跳转测试 — 管理后台",
};

export const dynamic = "force-dynamic";

export default function AdminToolsSsoTestPage() {
  const resolved = getToolsPublicOrigin();
  const rawToolsPublicOrigin = process.env.TOOLS_PUBLIC_ORIGIN?.trim() ?? "";
  const rawIssueOrigin = process.env.TOOLS_SSO_ISSUE_ORIGIN?.trim() ?? "";
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() ?? "";
  const diag = getToolsSsoSetupDiagnostics();

  return (
    <ToolsSsoTestClient
      resolvedOrigin={resolved}
      rawToolsPublicOrigin={rawToolsPublicOrigin}
      rawIssueOrigin={rawIssueOrigin}
      nextAuthUrl={nextAuthUrl}
      ssoReady={diag.ready}
      ssoIssues={diag.issues}
    />
  );
}
