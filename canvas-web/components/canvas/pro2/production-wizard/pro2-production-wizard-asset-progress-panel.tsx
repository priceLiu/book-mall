"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronUp,
  Loader2,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import {
  BACKGROUND_DOCK_EXIT_ANIM_MS,
  BACKGROUND_DOCK_LABEL_SUCCEEDED,
  resolveBackgroundGenerationLabel,
} from "@/lib/canvas/background-generation-dock-policy";
import {
  clearWizardAssetProgress,
  setWizardAssetProgressExpanded,
  subscribeWizardAssetProgress,
  type WizardAssetProgressState,
  wizardAssetProgressRunningCount,
} from "@/lib/canvas/pro2-wizard-asset-progress";
import { WIZARD_ASSET_KIND_LABEL } from "@/lib/canvas/pro2-production-wizard-assets";
import { WIZARD_SHOT_MEDIA_LABEL } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import type { WizardProgressKind } from "@/lib/canvas/pro2-wizard-asset-progress";
import { cn } from "@/lib/utils";

function progressKindPrefix(kind: WizardProgressKind): string {
  if (kind === "frame" || kind === "video") {
    return WIZARD_SHOT_MEDIA_LABEL[kind];
  }
  return WIZARD_ASSET_KIND_LABEL[kind];
}

function statusIcon(status: WizardAssetProgressState["items"][number]["status"]) {
  if (status === "running") {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-violet-300" />;
  }
  if (status === "succeeded") {
    return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />;
  }
  return <XCircle className="size-3.5 shrink-0 text-amber-400" />;
}

export function Pro2ProductionWizardAssetProgressPanel({
  mounted,
}: {
  mounted: boolean;
}) {
  const [state, setState] = useState<WizardAssetProgressState>({
    expanded: false,
    items: [],
  });
  const [now, setNow] = useState(() => Date.now());
  const [entered, setEntered] = useState(false);
  const [renderItems, setRenderItems] = useState(state.items);

  useEffect(() => subscribeWizardAssetProgress(setState), []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const items = state.items;
  const running = wizardAssetProgressRunningCount(state);
  const hasFailed = items.some((x) => x.status === "failed");
  const hasSuccessFlash = items.some((x) => x.status === "succeeded");
  const effectiveExpanded =
    state.expanded || hasSuccessFlash || (hasFailed && items.length > 0);

  useEffect(() => {
    if (items.length > 0) {
      setRenderItems(items);
      const frame = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setEntered(false);
  }, [items]);

  useEffect(() => {
    if (items.length > 0 || renderItems.length === 0) return;
    const timer = window.setTimeout(
      () => setRenderItems([]),
      BACKGROUND_DOCK_EXIT_ANIM_MS,
    );
    return () => window.clearTimeout(timer);
  }, [items.length, renderItems.length]);

  const displayItems = items.length > 0 ? items : renderItems;
  const exitingSuccess =
    items.length === 0 && renderItems.some((x) => x.status === "succeeded");

  const collapsedLabel = useMemo(() => {
    if (hasFailed) return "生成失败";
    if (running > 0) return `生成中 · ${running}`;
    if (hasSuccessFlash) return BACKGROUND_DOCK_LABEL_SUCCEEDED;
    return `生成 · ${displayItems.length}`;
  }, [displayItems.length, hasFailed, hasSuccessFlash, running]);

  if (!mounted || displayItems.length === 0) return null;

  const collapsed = !effectiveExpanded;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-[1200] flex flex-col items-end gap-2",
        "transition-transform duration-300 ease-out",
        entered && !exitingSuccess ? "translate-y-0" : "translate-y-2",
      )}
      role="status"
      aria-live="polite"
      aria-label="生成进度"
    >
      {collapsed ? (
        <button
          type="button"
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-lg transition hover:shadow-xl",
            hasFailed
              ? "border-red-400/45 bg-red-950/90 text-red-200"
              : "border-violet-400/35 bg-[#1c1c1e]/96 text-violet-100",
          )}
          onClick={() => setWizardAssetProgressExpanded(true)}
          aria-label="展开发生成进度"
        >
          {hasFailed ? (
            <XCircle className="size-4 shrink-0" />
          ) : running > 0 ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-violet-300" />
          ) : (
            <Sparkles className="size-4 shrink-0 text-violet-300" />
          )}
          <span>{collapsedLabel}</span>
          <ChevronUp className="size-3.5 opacity-50" />
        </button>
      ) : (
        <div
          className={cn(
            "pointer-events-auto w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1e]/96 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl",
            "transition-all duration-300 ease-out",
            entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
            <p className="text-[11px] font-medium text-white/90">
              生成进度
              {running > 0 ? ` · ${running} 进行中` : ""}
            </p>
            <div className="flex items-center gap-1">
              {running === 0 && !hasSuccessFlash ? (
                <button
                  type="button"
                  className="rounded p-0.5 text-white/45 transition hover:bg-white/10 hover:text-white/80"
                  aria-label="关闭"
                  onClick={() => clearWizardAssetProgress()}
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[10px] text-white/45 transition hover:bg-white/10 hover:text-white/80"
                  onClick={() => setWizardAssetProgressExpanded(false)}
                >
                  最小化
                </button>
              )}
            </div>
          </div>
          <ul className="max-h-[min(40vh,240px)] overflow-y-auto px-2 py-2">
            {displayItems.map((item) => (
              <li
                key={item.jobId}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5"
              >
                {statusIcon(item.status)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-zinc-100">
                    {item.kind === "frame" || item.kind === "video"
                      ? item.label
                      : `${progressKindPrefix(item.kind)} · ${item.label}`}
                  </p>
                  <p
                    className={cn(
                      "truncate text-[10px]",
                      item.status === "failed"
                        ? "text-amber-300/90"
                        : "text-zinc-500",
                    )}
                  >
                    {item.status === "running"
                      ? resolveBackgroundGenerationLabel(item.startedAt, now)
                      : item.status === "succeeded"
                        ? BACKGROUND_DOCK_LABEL_SUCCEEDED
                        : item.detail ?? "失败"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>,
    document.body,
  );
}
