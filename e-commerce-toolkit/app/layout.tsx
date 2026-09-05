import type { Metadata } from "next";
import { DialogProvider } from "@/components/dialogs/dialog-provider";
import { EcomShell } from "@/components/layout/ecom-shell";
import { EcomSiteNavGuard } from "@/components/layout/ecom-site-nav-guard";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "电商工具箱",
    template: "%s · 电商工具箱",
  },
  description: "电商主图、详情、带货视频与品牌 VI 的一站式 AI 工具箱。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#0c0c0e] font-sans antialiased">
        <DialogProvider>
          <EcomSiteNavGuard />
          <EcomShell>{children}</EcomShell>
        </DialogProvider>
      </body>
    </html>
  );
}
