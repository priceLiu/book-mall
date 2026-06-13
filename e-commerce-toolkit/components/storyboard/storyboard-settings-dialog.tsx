"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import {
  hasBoundStoryboardModel,
  storyboardProviderLabel,
} from "@/lib/storyboard-model-pick";
import { cn } from "@/lib/utils";

import type {
  StoryboardVideoResolution,
  StoryboardWanxSize,
} from "@/lib/storyboard-gen-params";

export type StoryboardSettingsValue = {
  chatModelKey: string;
  imageModelKey: string;
  videoModelKey: string;
  aspectRatio: "16:9" | "9:16";
  imageSize: StoryboardWanxSize;
  videoResolution: StoryboardVideoResolution;
  durationSec: number;
  dialogueLang: "zh" | "en";
  /** 百炼 R2V 画布比例 */
  videoR2vRatio?: string;
  videoSeed?: string;
  videoPromptExtend?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: StoryboardSettingsValue;
  onChange: (patch: Partial<StoryboardSettingsValue>) => void;
  chatModels?: StoryboardGatewayModel[];
  onConfirm: () => void;
};

const optBtn = (active: boolean) =>
  cn(
    "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "border-[#1d1d1f] bg-[#f5f5f7] text-[#1d1d1f]"
      : "border-[#e8e8ed] bg-white text-[#1d1d1f] hover:border-[#d2d2d7]",
  );

/** 影片参数（不含生图/生视频模型，模型在卡片上单独选择） */
export function StoryboardSettingsDialog({
  open,
  onOpenChange,
  value,
  onChange,
  chatModels = [],
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>影片参数</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {chatModels.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-bold text-[#1d1d1f]">助手模型</p>
              <div className="space-y-2">
                {chatModels.map((m) => {
                  const active = value.chatModelKey === m.modelKey;
                  const disabled = !m.credentialBound;
                  return (
                    <button
                      key={m.modelKey}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ chatModelKey: m.modelKey })}
                      className={cn(
                        "w-full rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "border-[#1d1d1f] bg-[#f5f5f7]"
                          : "border-[#e8e8ed] bg-white hover:border-[#d2d2d7]",
                        disabled &&
                          "cursor-not-allowed opacity-45 hover:border-[#e8e8ed]",
                      )}
                    >
                      <span className="font-medium text-[#1d1d1f]">{m.displayName}</span>
                      {disabled ? (
                        <span className="mt-0.5 block text-xs text-[#86868b]">
                          未绑定 {storyboardProviderLabel(m.providerKind ?? "UNKNOWN")} 凭证
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {!hasBoundStoryboardModel(chatModels) ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-700">
                  当前 Gateway Key 未绑定任何助手可用厂商。请在 Gateway 控制台「厂商凭证」添加
                  百炼 / DeepSeek / KIE，并确保 sk-gw 已勾选对应凭证后在 Book 个人中心关联。
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-bold text-[#1d1d1f]">影片比例</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { v: "16:9" as const, label: "横版 16:9" },
                  { v: "9:16" as const, label: "竖版 9:16" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => onChange({ aspectRatio: opt.v })}
                  className={optBtn(value.aspectRatio === opt.v)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-[#1d1d1f]">对白语言</p>
            <div className="flex gap-2">
              {(
                [
                  { v: "zh" as const, label: "中文" },
                  { v: "en" as const, label: "英文" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => onChange({ dialogueLang: opt.v })}
                  className={cn(optBtn(value.dialogueLang === opt.v), "flex-1")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-[#1d1d1f]">
              成片时长 {value.durationSec}s
            </label>
            <input
              type="range"
              min={4}
              max={15}
              value={value.durationSec}
              onChange={(e) => onChange({ durationSec: Number(e.target.value) })}
              className="w-full"
            />
            <p className="mt-1 text-xs text-[#86868b]">整图成片模式使用此时长；分镜合并按各镜头时长拼接。</p>
          </div>
        </div>

        <DialogFooter>
          <EcomButtonPrimary type="button" onClick={onConfirm}>
            确认
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
