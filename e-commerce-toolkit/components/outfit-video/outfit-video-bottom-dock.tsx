"use client";

import type { ReactNode } from "react";
import { Clapperboard, Loader2, Lock, Sparkles } from "lucide-react";

import { EcomAssistantBottomDock } from "@/components/layout/ecom-assistant-bottom-dock";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
} from "@/lib/ecom-assistant-chat-styles";
import {
  outfitBottomDockHint,
  outfitBottomDockWelcome,
  type OutfitBottomDockMode,
} from "@/lib/outfit-video-dock-workflow";
import { cn } from "@/lib/utils";

type ThreadProps = {
  mode: OutfitBottomDockMode;
};

export function OutfitVideoBottomDockThread({ mode }: ThreadProps) {
  return (
    <section className="space-y-3" aria-label="穿搭视频引导">
      <div className="flex w-full justify-start">
        <div className={cn(ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE, ECOM_ASSISTANT_BUBBLE_CLASS)}>
          <p className="whitespace-pre-wrap leading-relaxed">{outfitBottomDockWelcome(mode)}</p>
        </div>
      </div>
    </section>
  );
}

type ComposerProps = {
  mode: OutfitBottomDockMode;
  busy?: boolean;
  /** 拆镜/生成进行中 · 覆盖底栏 hint 为细粒度状态 */
  progressHint?: string;
  onSplitScenes?: () => void | Promise<void>;
  onLockRefs?: () => void | Promise<void>;
  onGenerateShots?: () => void | Promise<void>;
  onCompose?: () => void | Promise<void>;
};

export function OutfitVideoBottomDockComposer({
  mode,
  busy,
  progressHint,
  onSplitScenes,
  onLockRefs,
  onGenerateShots,
  onCompose,
}: ComposerProps) {
  const hint =
    progressHint?.trim() ||
    outfitBottomDockHint(mode);

  let action: ReactNode = null;
  if (mode === "split-ready" && onSplitScenes) {
    action = (
      <EcomButtonPrimary
        type="button"
        size="sm"
        className="shrink-0"
        disabled={busy}
        onClick={() => void onSplitScenes()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            拆解中…
          </>
        ) : (
          <>
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            拆解
          </>
        )}
      </EcomButtonPrimary>
    );
  } else if (mode === "refs-ready" && onLockRefs) {
    action = (
      <EcomButtonPrimary
        type="button"
        size="sm"
        className="shrink-0"
        disabled={busy}
        onClick={() => void onLockRefs()}
      >
        <Lock className="mr-1 h-3.5 w-3.5" />
        锁定特征
      </EcomButtonPrimary>
    );
  } else if (mode === "generate-ready" && onGenerateShots) {
    action = (
      <EcomButtonPrimary
        type="button"
        size="sm"
        className="shrink-0"
        disabled={busy}
        onClick={() => void onGenerateShots()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            生成中…
          </>
        ) : (
          <>
            <Clapperboard className="mr-1 h-3.5 w-3.5" />
            逐镜生成视频
          </>
        )}
      </EcomButtonPrimary>
    );
  } else if (mode === "compose-ready" && onCompose) {
    action = (
      <EcomButtonPrimary
        type="button"
        size="sm"
        className="shrink-0"
        disabled={busy}
        onClick={() => void onCompose()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            合成中…
          </>
        ) : (
          <>
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            合成成片
          </>
        )}
      </EcomButtonPrimary>
    );
  }

  return (
    <EcomAssistantBottomDock
      composerSweep={
        mode === "split-busy" || mode === "generate-busy" || mode === "compose-busy"
      }
      composer={
        <div className="flex min-h-[2.25rem] flex-1 items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-[#86868b]">{hint}</p>
          {action}
        </div>
      }
    />
  );
}
