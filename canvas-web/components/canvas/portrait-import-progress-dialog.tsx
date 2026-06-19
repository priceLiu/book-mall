"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import {
  closePortraitImportProgress,
  portraitImportProgressPercent,
  portraitImportProgressTitle,
  subscribePortraitImportProgress,
  type PortraitImportProgressState,
} from "@/lib/canvas/portrait-import-progress";
import { cn } from "@/lib/utils";

function stepHint(state: PortraitImportProgressState): string | null {
  if (state.projectAsset.status === "running") {
    return state.projectAsset.detail ?? "写入项目资产…";
  }
  if (state.volcengine.status === "running") {
    return state.volcengine.detail ?? "火山私域人像库…";
  }
  if (state.volcengine.status === "error") {
    return state.volcengine.detail ?? "火山侧失败";
  }
  if (state.projectAsset.status === "error") {
    return state.projectAsset.detail ?? "项目资产写入失败";
  }
  if (
    state.volcengine.status === "success" &&
    state.projectAsset.status === "success"
  ) {
    return state.projectAsset.detail ?? "入库完成";
  }
  return null;
}

function PortraitImportProgressBar({
  state,
}: {
  state: PortraitImportProgressState;
}) {
  const pct = portraitImportProgressPercent(state);
  const title = portraitImportProgressTitle(state);
  const hint = stepHint(state);
  const isError =
    state.canClose &&
    (state.volcengine.status === "error" ||
      state.projectAsset.status === "error");

  useEffect(() => {
    if (!state.canClose || isError) return;
    if (
      state.volcengine.status !== "success" ||
      state.projectAsset.status !== "success"
    ) {
      return;
    }
    const t = window.setTimeout(() => closePortraitImportProgress(), 5000);
    return () => window.clearTimeout(t);
  }, [state.canClose, state.volcengine.status, state.projectAsset.status, isError]);

  return (
    <div
      className="pointer-events-auto fixed bottom-4 right-4 z-[9998] w-[min(300px,calc(100vw-2rem))]"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="rounded-lg border border-white/10 bg-[#1c1c1e]/96 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="mb-1.5 flex items-center gap-2">
          {!state.canClose ? (
            <Loader2 className="size-3 shrink-0 animate-spin text-cyan-300" />
          ) : null}
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/90">
            {title}
          </p>
          {state.canClose ? (
            <button
              type="button"
              className="nodrag shrink-0 rounded p-0.5 text-white/45 transition hover:bg-white/10 hover:text-white/80"
              aria-label="关闭"
              onClick={() => closePortraitImportProgress()}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="h-0.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isError ? "bg-amber-400/90" : "bg-cyan-400/90",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {hint ? (
          <p
            className={cn(
              "mt-1 truncate text-[10px]",
              isError ? "text-amber-200/80" : "text-white/40",
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PortraitImportProgressHost() {
  const [state, setState] = useState<PortraitImportProgressState>(() => ({
    open: false,
    canClose: false,
    volcengine: { status: "pending" },
    projectAsset: { status: "pending" },
  }));

  useEffect(() => subscribePortraitImportProgress(setState), []);

  if (!state.open || typeof document === "undefined") return null;
  return createPortal(
    <PortraitImportProgressBar state={state} />,
    document.body,
  );
}
