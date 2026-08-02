import type { Metadata } from "next";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "快速复刻",
    template: "%s · QuickReplica",
  },
  description: "按示例快速复刻生成视频、图像与场景",
};

/**
 * 不走 next/font/google：构建/离线时拉取 Google Fonts 易 Abort，导致首屏卡死。
 * 字体栈与 DESIGN.md MiniMax 变体一致（系统无衬线优先）。
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body
        className="h-dvh overflow-hidden antialiased"
        style={{
          background: "var(--qr-bg-page)",
          color: "var(--qr-text-primary)",
          fontFamily:
            "var(--font-dm-sans, 'Helvetica Neue'), Helvetica, Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
