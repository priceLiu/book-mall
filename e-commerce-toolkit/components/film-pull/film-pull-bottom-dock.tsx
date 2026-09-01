"use client";

import { Cpu, Loader2 } from "lucide-react";

import { EcomAssistantBottomDock } from "@/components/layout/ecom-assistant-bottom-dock";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
} from "@/lib/ecom-assistant-chat-styles";
import type { FilmPullPhase } from "@/lib/film-pull-types";
import { cn } from "@/lib/utils";

type ThreadProps = {
  phase: FilmPullPhase;
  hasResult: boolean;
};

/** 内容区 · 拉片流程引导 */
export function FilmPullBottomThread({ phase, hasResult }: ThreadProps) {
  const welcome =
    phase === "analyze" && !hasResult
      ? "上传 ≤60s 视频后，点「拉片」开始工业化逐镜分析。"
      : phase === "analyze" && hasResult
        ? "拉片已完成。请在下方审校分镜表，保存后生成渲染脚本。"
        : phase === "review"
          ? "审校分镜表无误后，点底部「生成渲染脚本」进入换角出镜。"
          : phase === "replace"
            ? "在上方上传角色参考图，点底部「批量出镜」生成逐镜视频。"
            : "逐镜出镜完成后，点底部「合成成片」输出最终视频。";

  return (
    <section className="space-y-3" aria-label="拉片引导">
      <div className="flex w-full justify-start">
        <div className={cn(ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE, ECOM_ASSISTANT_BUBBLE_CLASS)}>
          <p className="whitespace-pre-wrap leading-relaxed">{welcome}</p>
        </div>
      </div>
    </section>
  );
}

type ComposerProps = {
  phase: FilmPullPhase;
  busy?: boolean;
  analyzing?: boolean;
  renderScripting?: boolean;
  analyzeDisabled?: boolean;
  videoModelLabel?: string;
  onPickVideoModel?: () => void;
  onAbortAnalyze?: () => void;
  onSaveShots?: () => void;
  onRenderScript?: () => void;
  onBatchGenerate?: () => void;
  onFinalRender?: () => void;
  onExportZip?: () => void;
};

/** 底栏 · 按阶段展示主操作 */
export function FilmPullBottomComposer({
  phase,
  busy,
  analyzing,
  renderScripting,
  analyzeDisabled,
  videoModelLabel,
  onPickVideoModel,
  onAbortAnalyze,
  onSaveShots,
  onRenderScript,
  onBatchGenerate,
  onFinalRender,
  onExportZip,
}: ComposerProps) {
  return (
    <EcomAssistantBottomDock
      composer={
        <div className="flex min-h-[2.25rem] w-full flex-1 flex-wrap items-center justify-end gap-2">
          {phase === "analyze" ? (
            <>
              {analyzing && onAbortAnalyze ? (
                <EcomButtonSecondary size="sm" type="button" onClick={() => void onAbortAnalyze()}>
                  中止
                </EcomButtonSecondary>
              ) : null}
              <p className="mr-auto min-w-0 flex-1 truncate text-sm text-[#86868b]">
                {analyzing ? "拉片进行中…" : "确认视频与指令后，在上方点「拉片」"}
              </p>
            </>
          ) : null}

          {phase === "review" ? (
            <>
              <p className="mr-auto min-w-0 flex-1 truncate text-sm text-[#86868b]">
                审校完成后生成渲染脚本
              </p>
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={busy}
                onClick={() => void onSaveShots?.()}
              >
                保存审校
              </EcomButtonSecondary>
              <EcomButtonPrimary
                size="sm"
                type="button"
                disabled={busy || renderScripting}
                onClick={() => void onRenderScript?.()}
              >
                {renderScripting ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    脚本生成中…
                  </>
                ) : (
                  "生成渲染脚本"
                )}
              </EcomButtonPrimary>
            </>
          ) : null}

          {phase === "replace" ? (
            <>
              <p className="mr-auto min-w-0 flex-1 truncate text-sm text-[#86868b]">
                上传角色图后批量出镜
              </p>
              {onPickVideoModel ? (
                <EcomButtonSecondary size="sm" type="button" disabled={busy} onClick={onPickVideoModel}>
                  <Cpu className="mr-1 h-3.5 w-3.5" />
                  {videoModelLabel ?? "视频模型"}
                </EcomButtonSecondary>
              ) : null}
              <EcomButtonPrimary
                size="sm"
                type="button"
                disabled={busy}
                onClick={() => void onBatchGenerate?.()}
              >
                批量出镜
              </EcomButtonPrimary>
            </>
          ) : null}

          {phase === "output" ? (
            <>
              <p className="mr-auto min-w-0 flex-1 truncate text-sm text-[#86868b]">
                合成最终成片或导出交付包
              </p>
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={busy}
                onClick={() => void onExportZip?.()}
              >
                导出 ZIP
              </EcomButtonSecondary>
              <EcomButtonPrimary
                size="sm"
                type="button"
                disabled={busy}
                onClick={() => void onFinalRender?.()}
              >
                合成成片
              </EcomButtonPrimary>
            </>
          ) : null}
        </div>
      }
    />
  );
}
