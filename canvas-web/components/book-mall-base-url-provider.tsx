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

export function useBookMallBaseUrl(): string {
  return useContext(BookMallBaseUrlContext);
}
