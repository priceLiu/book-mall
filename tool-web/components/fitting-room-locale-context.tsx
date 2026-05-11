"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FittingRoomLocale, FittingRoomMsgKey } from "@/lib/fitting-room-messages";
import { fittingRoomMessages } from "@/lib/fitting-room-messages";

const STORAGE_KEY = "fitting-room-locale";

type Ctx = {
  locale: FittingRoomLocale;
  setLocale: (loc: FittingRoomLocale) => void;
  t: (key: FittingRoomMsgKey) => string;
};

const FittingRoomLocaleContext = createContext<Ctx | null>(null);

export function FittingRoomLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<FittingRoomLocale>("zh");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "en" || raw === "zh") setLocaleState(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((loc: FittingRoomLocale) => {
    setLocaleState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: FittingRoomMsgKey) => {
      const dict = fittingRoomMessages[locale];
      return dict[key] ?? key;
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <FittingRoomLocaleContext.Provider value={value}>
      {children}
    </FittingRoomLocaleContext.Provider>
  );
}

export function useFittingRoomLocale(): Ctx {
  const ctx = useContext(FittingRoomLocaleContext);
  if (!ctx) {
    throw new Error("useFittingRoomLocale must be used within FittingRoomLocaleProvider");
  }
  return ctx;
}
