import type { Metadata } from "next";
import "./globals.css";
import { ToolShell } from "@/components/tool-shell";

export const metadata: Metadata = {
  title: "AI 工具站",
  description: "与主站 book-mall 通过 SSO 联通的独立工具前端",
};

/** 布局内请求主站 `/api/tools/nav-visibility`；会话由客户端 `/api/tools-session` 拉取（含 `tools_nav_keys` 套件门禁）。 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToolShell>{children}</ToolShell>
      </body>
    </html>
  );
}
