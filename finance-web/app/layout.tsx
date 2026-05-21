import type { Metadata } from "next";
import { BookMallBaseUrlProvider } from "@/components/book-mall-base-url-provider";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import "./globals.css";

/** 构建时 Docker 未注入 NEXT_PUBLIC_*；禁止静态固化空 baseUrl，须在运行时读 env */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "finance-web",
  description: "账单明细与对内计价演示（对齐云 consumedetailbillv2）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bookMallBaseUrl = getBookMallBaseUrlServer();

  return (
    <html lang="zh-CN">
      <body className="font-sans">
        <BookMallBaseUrlProvider baseUrl={bookMallBaseUrl}>
          {children}
        </BookMallBaseUrlProvider>
      </body>
    </html>
  );
}
