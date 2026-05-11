import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 工具站（试衣间等）",
  description: "与主站 book-mall 通过 SSO 换票联通的独立前端",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
