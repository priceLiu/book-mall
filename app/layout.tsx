import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthSessionProvider } from "@/components/providers/session-provider";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shadcn - 落地页模板",
  description: "基于 Shadcn 的落地页模板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="scroll-pt-28">
      <body className={cn("min-h-screen bg-background", inter.className)}>
        <AuthSessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
