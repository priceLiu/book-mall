import type { Metadata } from "next";
import { BookMallBaseUrlProvider } from "@/components/book-mall-base-url-provider";
import { CanvasAuthGate } from "@/components/auth/canvas-auth-gate";
import { CanvasShell } from "@/components/layout/canvas-shell";
import { DialogProvider } from "@/components/dialogs/dialog-provider";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import { getBookMallOrigin } from "@/lib/site-config";
import { getMainSiteOrigin } from "@/lib/site-origin";
import { PlatformAssistant } from "@private/platform-assistant";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "ZH 无限画布",
    template: "%s · ZH 无限画布",
  },
  description:
    "ZH 无限画布：影视专业版 2.0 节点工作流，拖拽编排、AI 生图生视频，一人即制作室。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bookMallBaseUrl = getBookMallBaseUrlServer() || getBookMallOrigin();
  const bookOrigin = getMainSiteOrigin() || bookMallBaseUrl || null;

  return (
    <html lang="zh-CN">
      <body className="canvas-sans">
        <BookMallBaseUrlProvider baseUrl={bookMallBaseUrl}>
          <DialogProvider>
            <CanvasAuthGate>
              <CanvasShell bookOrigin={bookOrigin}>{children}</CanvasShell>
            </CanvasAuthGate>
          </DialogProvider>
        </BookMallBaseUrlProvider>
        <PlatformAssistant title="AI 小智" />
      </body>
    </html>
  );
}
