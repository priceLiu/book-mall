import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "财务控制台 · finance-web",
  description: "账单明细与对内计价演示（对齐云 consumedetailbillv2）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans">{children}</body>
    </html>
  );
}
