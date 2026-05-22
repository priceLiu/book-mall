import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { BookMallBaseUrlProvider } from "@/components/book-mall-base-url-provider";
import { StoryShell } from "@/components/layout/story-shell";
import { StoryAuthBar } from "@/components/story-auth-bar";
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
    default: "story-web · 漫剧个人空间",
    template: "%s · story-web",
  },
  description: "漫剧创作个人空间：首页、创作室、影像室与 AI 模型配置。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bookMallBaseUrl = getBookMallBaseUrlServer();

  return (
    <html lang="zh-CN" className={`${playfair.variable} ${inter.variable}`}>
      <body className="story-sans">
        <BookMallBaseUrlProvider baseUrl={bookMallBaseUrl}>
          <StoryAuthBar />
          <StoryShell>{children}</StoryShell>
        </BookMallBaseUrlProvider>
      </body>
    </html>
  );
}
