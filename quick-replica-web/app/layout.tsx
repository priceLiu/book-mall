import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";

import "./globals.css";

export const dynamic = "force-dynamic";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "快速复制",
    template: "%s · QuickReplica",
  },
  description: "按示例快速复制生成视频、图像与场景",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${dmSans.variable} ${outfit.variable}`}>
      <body
        className="min-h-dvh antialiased"
        style={{
          background: "var(--qr-bg-page)",
          color: "var(--qr-text-primary)",
          fontFamily: "var(--font-dm-sans), 'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
