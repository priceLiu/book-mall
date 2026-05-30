import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { BookMallBaseUrlProvider } from "@/components/book-mall-base-url-provider";
import { CanvasShell } from "@/components/layout/canvas-shell";
import { DialogProvider } from "@/components/dialogs/dialog-provider";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import "./globals.css";

export const dynamic = "force-dynamic";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "canvas-web · AI 海报画布",
    template: "%s · canvas-web",
  },
  description:
    "无限画布 AI 设计工具：拖拽节点、风格迁移、产品融合，一人即设计室。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bookMallBaseUrl = getBookMallBaseUrlServer();

  return (
    <html lang="zh-CN" className={`${playfair.variable} ${inter.variable}`}>
      <body className="canvas-sans">
        <BookMallBaseUrlProvider baseUrl={bookMallBaseUrl}>
          <DialogProvider>
            <CanvasShell>{children}</CanvasShell>
          </DialogProvider>
        </BookMallBaseUrlProvider>
      </body>
    </html>
  );
}
