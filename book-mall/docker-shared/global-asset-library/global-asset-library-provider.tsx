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

import { GlobalAssetLibraryDialog } from "./global-asset-library-dialog";
import type {
  GlobalAssetLibraryApiClient,
  GlobalAssetLibraryVariant,
  OpenGlobalAssetLibraryOptions,
} from "./types";

type Ctx = {
  openGlobalAssetLibrary: (options: OpenGlobalAssetLibraryOptions) => void;
};

const GlobalAssetLibraryContext = createContext<Ctx | null>(null);

type ProviderProps = {
  children: ReactNode;
  api: GlobalAssetLibraryApiClient;
  variant?: GlobalAssetLibraryVariant;
  /** 弹层 open/close 回调（用于画布隐藏节点顶栏等） */
  onOpenChange?: (open: boolean) => void;
};

export function GlobalAssetLibraryProvider({
  children,
  api,
  variant = "light",
  onOpenChange,
}: ProviderProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OpenGlobalAssetLibraryOptions>({});

  const openGlobalAssetLibrary = useCallback((opts: OpenGlobalAssetLibraryOptions) => {
    setOptions(opts);
    setOpen(true);
  }, []);

  const closeGlobalAssetLibrary = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const value = useMemo(() => ({ openGlobalAssetLibrary }), [openGlobalAssetLibrary]);

  return (
    <GlobalAssetLibraryContext.Provider value={value}>
      {children}
      {open ? (
        <GlobalAssetLibraryDialog
          open={open}
          variant={variant}
          api={api}
          options={options}
          onClose={closeGlobalAssetLibrary}
        />
      ) : null}
    </GlobalAssetLibraryContext.Provider>
  );
}

export function useGlobalAssetLibrary(): Ctx {
  const ctx = useContext(GlobalAssetLibraryContext);
  if (!ctx) {
    throw new Error("useGlobalAssetLibrary 须在 GlobalAssetLibraryProvider 内使用");
  }
  return ctx;
}
