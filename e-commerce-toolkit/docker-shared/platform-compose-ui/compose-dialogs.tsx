"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ComposeAlertOptions = {
  title: string;
  message: string;
  variant?: "error" | "info" | "success";
};

export type ComposeToastOptions = {
  title: string;
  variant?: "error" | "info" | "success";
};

export type ComposeDialogsApi = {
  alert: (opts: ComposeAlertOptions) => Promise<void>;
  toast?: (opts: ComposeToastOptions) => void;
  confirm?: (opts: {
    title: string;
    message: string;
  }) => Promise<boolean>;
  prompt?: (opts: {
    title: string;
    label: string;
    defaultValue?: string;
  }) => Promise<string | null>;
};

const ComposeDialogsContext = createContext<ComposeDialogsApi | null>(null);

export function ComposeDialogsProvider({
  value,
  children,
}: {
  value: ComposeDialogsApi;
  children: ReactNode;
}) {
  return (
    <ComposeDialogsContext.Provider value={value}>{children}</ComposeDialogsContext.Provider>
  );
}

export function useComposeDialogs(): ComposeDialogsApi {
  const ctx = useContext(ComposeDialogsContext);
  if (!ctx) {
    throw new Error("useComposeDialogs requires ComposeDialogsProvider");
  }
  return ctx;
}
