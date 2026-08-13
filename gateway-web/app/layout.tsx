import type { Metadata } from "next";
import { PlatformAssistant } from "@private/platform-assistant";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gateway 控制台",
    template: "%s · Gateway",
  },
  description: "AI Gateway BYOK 控制台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <PlatformAssistant
          title="AI 小智"
          userSessionEndpoint="/api/book-mall/api/sso/tools/introspect"
        />
      </body>
    </html>
  );
}
