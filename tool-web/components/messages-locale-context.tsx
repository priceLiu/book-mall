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
import type { AiFitMsgKey } from "@/messages";
import { aiFitLabel, type ToolMessagesLocale } from "@/messages";

/** 与试衣间套装页共用键名，便于全站语言一致 */
const STORAGE_KEY = "fitting-room-locale";

type Ctx = {
  locale: ToolMessagesLocale;
  setLocale: (loc: ToolMessagesLocale) => void;
  t: (key: AiFitMsgKey) => string;
};

const MessagesLocaleContext = createContext<Ctx | null>(null);

export function MessagesLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<ToolMessagesLocale>("zh");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "en" || raw === "zh") setLocaleState(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((loc: ToolMessagesLocale) => {
    setLocaleState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: AiFitMsgKey) => aiFitLabel(locale, key),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <MessagesLocaleContext.Provider value={value}>{children}</MessagesLocaleContext.Provider>
  );
}

export function useMessagesLocale(): Ctx {
  const ctx = useContext(MessagesLocaleContext);
  if (!ctx) {
    throw new Error("useMessagesLocale must be used within MessagesLocaleProvider");
  }
  return ctx;
}
