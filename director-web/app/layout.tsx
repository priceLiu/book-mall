import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "3D导演台",
    template: "%s · 3D导演台",
  },
  description: "浏览器内的 3D 分镜导演台：机位规划、场景摆位、截图导出。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
