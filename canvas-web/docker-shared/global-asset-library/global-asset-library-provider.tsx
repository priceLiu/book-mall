"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { GlobalAssetLibraryDialog } from "./global-asset-library-dialog";
import { globalOptionsToUnified } from "./open-asset-library-utils";
import type {
  GlobalAssetLibraryApiClient,
  GlobalAssetLibraryVariant,
  OpenGlobalAssetLibraryOptions,
} from "./types";
import { UnifiedAssetLibraryDialog } from "./unified-asset-library-dialog";
import type {
  OpenAssetLibraryOptions,
  UnifiedAssetLibraryApiClient,
} from "./unified-asset-library-types";

type Ctx = {
  openGlobalAssetLibrary: (options: OpenGlobalAssetLibraryOptions) => void;
  openAssetLibrary: (options: OpenAssetLibraryOptions) => void;
};

const GlobalAssetLibraryContext = createContext<Ctx | null>(null);

export type UnifiedAssetLibraryDialogProps = {
  open: boolean;
  variant: GlobalAssetLibraryVariant;
  api: UnifiedAssetLibraryApiClient;
  options: OpenAssetLibraryOptions;
  onClose: () => void;
};

type ProviderProps = {
  children: ReactNode;
  api: GlobalAssetLibraryApiClient & Partial<Pick<UnifiedAssetLibraryApiClient, "fetchProjectItems">>;
  variant?: GlobalAssetLibraryVariant;
  defaultApp?: OpenAssetLibraryOptions["app"];
  onOpenChange?: (open: boolean) => void;
  /** 画布等：Hub 式三 Tab 弹层，替代默认 GALD UnifiedAssetLibraryDialog */
  UnifiedDialog?: ComponentType<UnifiedAssetLibraryDialogProps>;
  /** 路由变化时关闭弹层（由宿主应用在 layout 内传入 pathname 版本号） */
  routeChangeKey?: string;
  /** 路由变化时额外回调（如电商 unlock body） */
  onRouteChange?: () => void;
};

export function GlobalAssetLibraryProvider({
  children,
  api,
  variant = "light",
  defaultApp = "ecom",
  onOpenChange,
  UnifiedDialog,
  routeChangeKey,
  onRouteChange,
}: ProviderProps) {
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [legacyOptions, setLegacyOptions] = useState<OpenGlobalAssetLibraryOptions>({});
  const [unifiedOptions, setUnifiedOptions] = useState<OpenAssetLibraryOptions>({
    app: defaultApp,
  });

  const unifiedApi = api as UnifiedAssetLibraryApiClient;
  const UnifiedDialogComponent = UnifiedDialog ?? UnifiedAssetLibraryDialog;

  const openAssetLibrary = useCallback((opts: OpenAssetLibraryOptions) => {
    setUnifiedOptions(opts);
    setUnifiedOpen(true);
  }, []);

  const openGlobalAssetLibrary = useCallback(
    (opts: OpenGlobalAssetLibraryOptions) => {
      const mode = opts.mode ?? "pick";
      if (mode === "save" && opts.sourceImage?.url) {
        setLegacyOptions(opts);
        setLegacyOpen(true);
        return;
      }
      if (mode === "browse" && opts.embedded) {
        setLegacyOptions(opts);
        setLegacyOpen(true);
        return;
      }
      openAssetLibrary(globalOptionsToUnified(opts, defaultApp));
    },
    [defaultApp, openAssetLibrary],
  );

  const closeAll = useCallback(() => {
    setLegacyOpen(false);
    setUnifiedOpen(false);
  }, []);

  useEffect(() => {
    onOpenChange?.(legacyOpen || unifiedOpen);
  }, [legacyOpen, unifiedOpen, onOpenChange]);

  useEffect(() => {
    if (routeChangeKey === undefined) return;
    closeAll();
    onRouteChange?.();
  }, [routeChangeKey, closeAll, onRouteChange]);

  const value = useMemo(
    () => ({ openGlobalAssetLibrary, openAssetLibrary }),
    [openGlobalAssetLibrary, openAssetLibrary],
  );

  return (
    <GlobalAssetLibraryContext.Provider value={value}>
      {children}
      {legacyOpen ? (
        <GlobalAssetLibraryDialog
          open={legacyOpen}
          variant={variant}
          api={api}
          options={legacyOptions}
          onClose={closeAll}
        />
      ) : null}
      {unifiedOpen ? (
        <UnifiedDialogComponent
          open={unifiedOpen}
          variant={variant}
          api={unifiedApi}
          options={unifiedOptions}
          onClose={closeAll}
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

export function useAssetLibrary(): Ctx {
  return useGlobalAssetLibrary();
}
