import type { Metadata } from "next";
import { PublisherShell } from "@/components/layout/publisher-shell";
import { PlatformAssistant } from "@private/platform-assistant";
import "./globals.css";

export const metadata: Metadata = {
  title: "一键发布",
  description: "多平台社交内容一键分发 · 小红书 / 抖音 / 微博 / B站 / 公众号",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <PublisherShell>{children}</PublisherShell>
        <PlatformAssistant title="AI 小智" />
      </body>
    </html>
  );
}
