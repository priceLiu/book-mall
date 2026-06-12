"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { SessionKickedWatcher } from "@/components/auth/session-kicked-watcher";

const SESSION_RECHECK_SEC = Number(
  process.env.NEXT_PUBLIC_SINGLE_SESSION_RECHECK_SEC ?? "60",
);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={
        Number.isFinite(SESSION_RECHECK_SEC) && SESSION_RECHECK_SEC > 0
          ? SESSION_RECHECK_SEC
          : 60
      }
    >
      <SessionKickedWatcher />
      {children}
    </SessionProvider>
  );
}
