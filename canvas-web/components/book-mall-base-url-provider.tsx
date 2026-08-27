"use client";

import { createContext, useContext } from "react";

const BookMallBaseUrlContext = createContext("");

export function BookMallBaseUrlProvider({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: React.ReactNode;
}) {
  return (
    <BookMallBaseUrlContext.Provider value={baseUrl}>
      {children}
    </BookMallBaseUrlContext.Provider>
  );
}

/** 由根 layout 注入；勿在 client 直接读 process.env.NEXT_PUBLIC_BOOK_MALL_URL */
export function useBookMallBaseUrl(): string {
  return useContext(BookMallBaseUrlContext);
}
