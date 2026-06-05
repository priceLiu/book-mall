"use client";

import { Check, Cpu, Image as ImageIcon, Video } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  STORYBOARD_VIDEO_RESOLUTION_OPTIONS,
  STORYBOARD_WANX_SIZE_OPTIONS,
  aspectRatioForWanxSize,
  type StoryboardVideoResolution,
  type StoryboardWanxSize,
} from "@/lib/storyboard-gen-params";
import {
  STORYBOARD_R2V_RATIO_OPTIONS,
  isStoryboardBailianR2vModel,
  isStoryboardKling30KieVideoModel,
  isStoryboardWanR2vModel,
  type StoryboardVideoAspectRatio,
} from "@/lib/storyboard-video-params";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "image" | "video";
  models: StoryboardGatewayModel[];
  value: string;
  onChange: (key: string) => void;
  onConfirm: () => void;
  confirming?: boolean;
  panelIndex?: number | null;
  videoTarget?: "panel" | "fullSheet";
  aspectRatio?: StoryboardVideoAspectRatio;
  onAspectRatioChange?: (v: StoryboardVideoAspectRatio) => void;
  imageSize?: StoryboardWanxSize;
  onImageSizeChange?: (v: StoryboardWanxSize) => void;
  durationSec?: number;
  onDurationChange?: (v: number) => void;
  videoResolution?: StoryboardVideoResolution;
  onVideoResolutionChange?: (v: StoryboardVideoResolution) => void;
  panelDurationSec?: number;
  onPanelDurationChange?: (v: number) => void;
  videoR2vRatio?: string;
  onVideoR2vRatioChange?: (v: string) => void;
  videoSeed?: string;
  onVideoSeedChange?: (v: string) => void;
  videoPromptExtend?: boolean;
  onVideoPromptExtendChange?: (v: boolean) => void;
};

/** providerKind → 中文分组名（弹层标题用） */
const PROVIDER_LABELS: Record<string, string> = {
  DASHSCOPE: "通义万相",
  BAILIAN: "百炼",
  KIE: "KIE",
  VOLCENGINE: "火山方舟",
  HUNYUAN: "混元 3D",
  DEEPSEEK: "DeepSeek",
};

function providerLabel(kind: string): string {
  return PROVIDER_LABELS[kind] ?? kind;
}

function pickerTitle(
  mode: "image" | "video",
  panelIndex?: number | null,
  videoTarget?: "panel" | "fullSheet",
) {
  if (mode === "image") {
    return typeof panelIndex === "number" ? `镜头 ${panelIndex} · 重新生图` : "生成全部分镜图";
  }
  if (typeof panelIndex === "number") return `镜头 ${panelIndex} · 生成视频`;
  if (videoTarget === "fullSheet") return "整图成片 · 生成视频";
  return "选择视频模型";
}

/** 该模型在当前模式下可调参数数量（用于卡片角标） */
function countAdjustableParams(
  mode: "image" | "video",
  modelKey: string,
  videoTarget: "panel" | "fullSheet",
): number {
  if (mode === "image") return 1;
  let n = 2; // 视频分辨率 + 时长
  const isBailianR2v = isStoryboardBailianR2vModel(modelKey);
  if (isBailianR2v) {
    n += 2; // 画布比例 + 随机种子
    if (isStoryboardWanR2vModel(modelKey)) n += 1; // 智能扩写
  } else {
    n += 1; // 画面比例
  }
  // panel / fullSheet 都各有一个时长控件，已计入
  void videoTarget;
  return n;
}

function roleBadgeTone(role: string): string {
  switch (role) {
    case "IMAGE":
      return "bg-[#fff4e5] text-[#b25e09]";
    case "VIDEO":
      return "bg-[#e8f1ff] text-[#0058c7]";
    default:
      return "bg-[#eef0f2] text-[#6e6e73]";
  }
}

function ModelCard({
  model,
  selected,
  paramCount,
  onSelect,
}: {
  model: StoryboardGatewayModel;
  selected: boolean;
  paramCount: number;
  onSelect: () => void;
}) {
  const disabled = !model.credentialBound;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex h-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition",
        selected
          ? "border-[var(--ecom-primary)] bg-[#f0f6ff] shadow-sm"
          : "border-[#e8e8ed] bg-white hover:border-[#c7c7cc] hover:bg-[#fafafa]",
        disabled && "cursor-not-allowed opacity-50 hover:border-[#e8e8ed] hover:bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-1 text-[13px] font-semibold text-[#1d1d1f]">
          {model.displayName || model.modelKey}
        </p>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
            roleBadgeTone(model.role),
          )}
        >
          {model.role}
        </span>
      </div>
      <p className="line-clamp-1 font-mono text-[11px] text-[#86868b]">{model.modelKey}</p>
      {model.description ? (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-[#6e6e73]">
          {model.description}
        </p>
      ) : null}
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-[10px] text-[#a1a1a6]">
          {paramCount > 0 ? `${paramCount} 项可调参数` : "无可调参数"}
        </span>
        {disabled ? <span className="text-[10px] text-[#c0392b]">未绑定</span> : null}
      </div>
      {selected ? (
        <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-[var(--ecom-primary)] text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </button>
  );
}

/** 点击刷新/视频后弹出：卡片选模型 + 下方动态参数 */
export function StoryboardModelPickerDialog({
  open,
  onOpenChange,
  mode,
  models,
  value,
  onChange,
  onConfirm,
  confirming,
  panelIndex,
  videoTarget = "fullSheet",
  aspectRatio = "9:16",
  onAspectRatioChange,
  imageSize = "720*1280",
  onImageSizeChange,
  durationSec = 10,
  onDurationChange,
  videoResolution = "1080p",
  onVideoResolutionChange,
  panelDurationSec = 3,
  onPanelDurationChange,
  videoR2vRatio = "9:16",
  onVideoR2vRatioChange,
  videoSeed = "",
  onVideoSeedChange,
  videoPromptExtend = true,
  onVideoPromptExtendChange,
}: Props) {
  const action = mode === "image" ? "开始生图" : "开始生成";
  const isBailianR2v = mode === "video" && isStoryboardBailianR2vModel(value);
  const isKling30 = mode === "video" && isStoryboardKling30KieVideoModel(value);
  const showImageSize = mode === "image";
  const showAspect = mode === "video" && !isBailianR2v;
  const showR2vRatio = mode === "video" && isBailianR2v;
  const showFullDuration = mode === "video" && videoTarget === "fullSheet";
  const showPanelDuration = mode === "video" && videoTarget === "panel";
  const showResolution = mode === "video";
  const showWanR2vExtras = mode === "video" && isStoryboardWanR2vModel(value);
  const showR2vSeed = mode === "video" && isBailianR2v;
  const fullDurationMin = isBailianR2v ? 3 : 4;

  const selectedModel = models.find((m) => m.modelKey === value) ?? null;

  // 按 providerKind 分组，保持原始顺序
  const groups: { kind: string; models: StoryboardGatewayModel[] }[] = [];
  for (const m of models) {
    let g = groups.find((x) => x.kind === m.providerKind);
    if (!g) {
      g = { kind: m.providerKind, models: [] };
      groups.push(g);
    }
    g.models.push(m);
  }

  const ModeIcon = mode === "image" ? ImageIcon : Video;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[#f0f0f2] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <ModeIcon className="h-4 w-4 text-[var(--ecom-primary)]" />
            {pickerTitle(mode, panelIndex, videoTarget)}
          </DialogTitle>
          <p className="text-[12px] text-[#86868b]">
            {mode === "image"
              ? "选择生图模型并调整尺寸，用于生成分镜图。"
              : "图生视频模型（多图参考整图成片），需对应 Gateway Provider。"}
          </p>
        </DialogHeader>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {groups.length === 0 ? (
            <div className="grid place-items-center px-4 py-10 text-center text-sm text-[#86868b]">
              暂无可用{mode === "image" ? "生图" : "视频"}模型，请先在 Gateway 绑定凭证。
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.kind}>
                  <header className="mb-2 flex items-center gap-2">
                    <h3 className="text-[12px] font-semibold text-[#1d1d1f]">
                      Gateway · {providerLabel(g.kind)}
                    </h3>
                    <span className="rounded bg-[#eef0f2] px-1.5 py-0.5 text-[10px] text-[#86868b]">
                      {g.kind}
                    </span>
                  </header>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.models.map((m) => (
                      <ModelCard
                        key={m.modelKey}
                        model={m}
                        selected={m.modelKey === value}
                        paramCount={countAdjustableParams(mode, m.modelKey, videoTarget)}
                        onSelect={() => onChange(m.modelKey)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <section className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
                <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f]">
                  <Cpu className="h-3.5 w-3.5 text-[#86868b]" />
                  模型参数
                  <span className="font-normal text-[#86868b]">
                    {selectedModel?.displayName ?? value}
                  </span>
                </p>

                <div className="space-y-4">
                  {showImageSize ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#6e6e73]">输出分辨率（尺寸）</span>
                      <select
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                        value={imageSize}
                        onChange={(e) => {
                          const next = e.target.value as StoryboardWanxSize;
                          onImageSizeChange?.(next);
                          onAspectRatioChange?.(aspectRatioForWanxSize(next));
                        }}
                      >
                        {STORYBOARD_WANX_SIZE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {showAspect ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#6e6e73]">画面比例</span>
                      <select
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                        value={aspectRatio}
                        onChange={(e) =>
                          onAspectRatioChange?.(e.target.value as StoryboardVideoAspectRatio)
                        }
                      >
                        <option value="9:16">9:16 竖屏</option>
                        <option value="16:9">16:9 横屏</option>
                        {isKling30 ? <option value="1:1">1:1</option> : null}
                      </select>
                    </label>
                  ) : null}

                  {showR2vRatio ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#6e6e73]">画布比例（百炼 R2V）</span>
                      <select
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                        value={videoR2vRatio}
                        onChange={(e) => onVideoR2vRatioChange?.(e.target.value)}
                      >
                        {STORYBOARD_R2V_RATIO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {showResolution ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#6e6e73]">视频分辨率</span>
                      <select
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                        value={videoResolution}
                        onChange={(e) =>
                          onVideoResolutionChange?.(e.target.value as StoryboardVideoResolution)
                        }
                      >
                        {STORYBOARD_VIDEO_RESOLUTION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {showFullDuration ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#6e6e73]">成片时长 {durationSec}s</span>
                      <input
                        type="range"
                        min={fullDurationMin}
                        max={15}
                        step={1}
                        value={durationSec}
                        onChange={(e) => onDurationChange?.(Number(e.target.value))}
                        className="w-full accent-[var(--ecom-primary)]"
                      />
                      <div className="flex justify-between text-[10px] text-[#86868b]">
                        <span>{fullDurationMin}s</span>
                        <span>15s</span>
                      </div>
                    </label>
                  ) : null}

                  {showWanR2vExtras ? (
                    <label className="flex items-center gap-2 text-sm text-[#1d1d1f]">
                      <input
                        type="checkbox"
                        checked={videoPromptExtend}
                        onChange={(e) => onVideoPromptExtendChange?.(e.target.checked)}
                        className="accent-[var(--ecom-primary)]"
                      />
                      <span>智能扩写提示词（万相 R2V）</span>
                    </label>
                  ) : null}

                  {showR2vSeed ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#6e6e73]">随机种子（可选）</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="留空则随机"
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
                        value={videoSeed}
                        onChange={(e) => onVideoSeedChange?.(e.target.value)}
                      />
                    </label>
                  ) : null}

                  {showPanelDuration ? (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#6e6e73]">镜头时长 {panelDurationSec}s</span>
                      <input
                        type="range"
                        min={2}
                        max={8}
                        step={1}
                        value={panelDurationSec}
                        onChange={(e) => onPanelDurationChange?.(Number(e.target.value))}
                        className="w-full accent-[var(--ecom-primary)]"
                      />
                      <div className="flex justify-between text-[10px] text-[#86868b]">
                        <span>2s</span>
                        <span>8s</span>
                      </div>
                    </label>
                  ) : null}
                </div>
              </section>
            </div>
          )}
        </div>

        <DialogFooter className="items-center justify-between border-t border-[#f0f0f2] px-5 py-3 sm:justify-between">
          <span className="text-[11px] text-[#86868b]">
            {confirming ? "生成在后台进行，可直接关闭此窗口。" : "选好模型与参数后开始生成。"}
          </span>
          <div className="flex items-center gap-2">
            <EcomButtonSecondary type="button" size="sm" onClick={() => onOpenChange(false)}>
              {confirming ? "关闭" : "取消"}
            </EcomButtonSecondary>
            <EcomButtonPrimary type="button" size="sm" onClick={onConfirm} disabled={confirming}>
              {confirming ? "生成中…" : action}
            </EcomButtonPrimary>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
