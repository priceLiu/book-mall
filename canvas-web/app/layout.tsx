import type { Metadata } from "next";
import { BookMallBaseUrlProvider } from "@/components/book-mall-base-url-provider";
import { CanvasAuthGate } from "@/components/auth/canvas-auth-gate";
import { CanvasShell } from "@/components/layout/canvas-shell";
import { DialogProvider } from "@/components/dialogs/dialog-provider";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import "./globals.css";

export const dynamic = "force-dynamic";

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
    <html lang="zh-CN">
      <body className="canvas-sans">
        <BookMallBaseUrlProvider baseUrl={bookMallBaseUrl}>
          <DialogProvider>
            <CanvasAuthGate>
              <CanvasShell>{children}</CanvasShell>
            </CanvasAuthGate>
          </DialogProvider>
        </BookMallBaseUrlProvider>
      </body>
    </html>
  );
}
