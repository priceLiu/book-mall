import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { DialogProvider } from "@/components/dialogs/dialog-provider";
import { getShellUser } from "@/lib/session.server";
import { getMainSiteOrigin } from "@/lib/site-origin";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "常用工具 · AI 图像小工具",
    template: "%s · 常用工具",
  },
  description:
    "修图、扩图、背景移除、表情包、海报等 AI 图像小工具。注册送体验积分，全站通用。",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getShellUser();
  const bookOrigin = getMainSiteOrigin() ?? "http://localhost:3000";

  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased text-[#1d1d1f]">
        <DialogProvider>
          <AppShell user={user} bookOrigin={bookOrigin}>
            {children}
          </AppShell>
        </DialogProvider>
      </body>
    </html>
  );
}
