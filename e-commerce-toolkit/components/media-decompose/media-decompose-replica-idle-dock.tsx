"use client";

import { Clapperboard, Loader2 } from "lucide-react";

import { EcomAssistantBottomDock } from "@/components/layout/ecom-assistant-bottom-dock";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
} from "@/lib/ecom-assistant-chat-styles";
import { cn } from "@/lib/utils";

type IdleThreadProps = {
  mode: "idle" | "ready" | "replica-setup";
};

/** 内容区：复刻开始前的引导对话 */
export function MediaDecomposeReplicaIdleThread({ mode }: IdleThreadProps) {
  const welcome =
    mode === "replica-setup"
      ? "复刻采集已在上方展开：上传模特图、产品图，填写卖点后点「生成复刻脚本」。"
      : mode === "ready"
        ? "拆解已完成。点击底部「一键复刻」，在上方完成模特/产品采集与脚本生成。"
        : "上传素材并完成拆解后，可开始一键复刻。";

  return (
    <section className="space-y-3" aria-label="复刻引导">
      <div className="flex w-full justify-start">
        <div className={cn(ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE, ECOM_ASSISTANT_BUBBLE_CLASS)}>
          <p className="whitespace-pre-wrap leading-relaxed">{welcome}</p>
        </div>
      </div>
    </section>
  );
}

type IdleComposerProps = {
  mode: "idle" | "ready" | "replica-setup";
  busy?: boolean;
  onStartReplica?: () => void | Promise<void>;
};

/** 底栏：拆解后一键复刻 / 复刻进行中提示 */
export function MediaDecomposeReplicaIdleComposer({ mode, busy, onStartReplica }: IdleComposerProps) {
  return (
    <EcomAssistantBottomDock
      composer={
        <div className="flex min-h-[2.25rem] flex-1 items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-[#86868b]">
            {mode === "replica-setup"
              ? "在上方上传参考图并生成复刻脚本…"
              : mode === "ready"
                ? "点击「一键复刻」开始…"
                : "完成拆解后可开始复刻…"}
          </p>
          {mode === "ready" && onStartReplica ? (
            <EcomButtonPrimary
              type="button"
              size="sm"
              className="shrink-0"
              disabled={busy}
              onClick={() => void onStartReplica()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  准备中…
                </>
              ) : (
                <>
                  <Clapperboard className="mr-1 h-3.5 w-3.5" />
                  一键复刻
                </>
              )}
            </EcomButtonPrimary>
          ) : null}
        </div>
      }
    />
  );
}
