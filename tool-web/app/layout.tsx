import type { Metadata } from "next";
import "./globals.css";
import { ToolShell } from "@/components/tool-shell";

export const metadata: Metadata = {
  title: "AI 工具站",
  description: "与主站 book-mall 通过 SSO 联通的独立工具前端",
};

/** 读 Cookie 判定是否有令牌；具体会话由客户端 `/api/tools-session` 拉取，勿在布局 await 主站 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <ToolShell>{children}</ToolShell>
      </body>
    </html>
  );
}
