"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import { ImageSingleUpload } from "@/components/image-processing/image-single-upload";
import {
  DEFAULT_NEGATIVE_PROMPT_PLACEHOLDER,
  GENERATIVE_IMAGE_COUNT_OPTIONS,
  GENERATIVE_MODEL_OPTIONS,
} from "@/lib/image-processing-presets";
import { cn } from "@/lib/utils";

const ASPECT_OPTIONS = ["1:1", "16:9", "9:16", "4:5", "3:4", "4:3"] as const;

const SEEDREAM_ASPECT_TO_SIZE: Record<string, string> = {
  "1:1": "2048x2048",
  "16:9": "2048x1152",
  "9:16": "1152x2048",
  "4:5": "1638x2048",
  "3:4": "1536x2048",
  "4:3": "2048x1536",
};

export function ImageGenerativeSettings({
  generativeModel,
  onGenerativeModelChange,
  imageCount,
  onImageCountChange,
  seed,
  onSeedChange,
  aspect,
  onAspectChange,
  params,
  onParamsChange,
  advancedOpen,
  onAdvancedOpenChange,
  styleImage,
  onStyleImageChange,
  hideModelSelect = false,
  hideImageCount = false,
  modelOptions = GENERATIVE_MODEL_OPTIONS,
}: {
  generativeModel: string;
  onGenerativeModelChange: (v: string) => void;
  imageCount: string;
  onImageCountChange: (v: string) => void;
  seed: string;
  onSeedChange: (v: string) => void;
  aspect: string;
  onAspectChange: (v: string) => void;
  params: Record<string, unknown>;
  onParamsChange: (next: Record<string, unknown>) => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (v: boolean) => void;
  styleImage: string | null;
  onStyleImageChange: (v: string | null) => void;
  hideModelSelect?: boolean;
  hideImageCount?: boolean;
  modelOptions?: ReadonlyArray<{ id: string; label: string }>;
}) {
  const strength = Number(params.strength ?? 0.5);

  return (
    <div className="mt-4 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
      <div
        className={cn(
          "grid gap-4",
          hideModelSelect && hideImageCount
            ? "sm:grid-cols-1"
            : hideModelSelect || hideImageCount
              ? "sm:grid-cols-2"
              : "sm:grid-cols-2",
        )}
      >
        {hideModelSelect ? null : (
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">模型</label>
            <select
              value={generativeModel}
              onChange={(e) => onGenerativeModelChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {modelOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {hideImageCount ? null : (
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">图片</label>
            <select
              value={imageCount}
              onChange={(e) => onImageCountChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {GENERATIVE_IMAGE_COUNT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-[#1d1d1f]">种子</label>
          <input
            type="text"
            placeholder="随机的"
            value={seed}
            onChange={(e) => onSeedChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-[#1d1d1f]">长宽比</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ASPECT_OPTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onAspectChange(a)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium",
                aspect === a
                  ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                  : "border-[#e5e5ea] bg-white text-[#1d1d1f]",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAdvancedOpenChange(!advancedOpen)}
        className="mt-4 inline-flex items-center gap-1 text-sm text-[#0071e3]"
      >
        {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        高级选项
      </button>

      {advancedOpen ? (
        <div className="mt-3 space-y-4 rounded-xl border border-[#e5e5ea] bg-white p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[#1d1d1f]">负面提示（应避免的情况）</span>
            <input
              type="text"
              placeholder={DEFAULT_NEGATIVE_PROMPT_PLACEHOLDER}
              value={String(params.negative_prompt ?? "")}
              onChange={(e) =>
                onParamsChange({ ...params, negative_prompt: e.target.value })
              }
              className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
            />
          </label>

          <div className="block text-sm">
            <span className="mb-2 block text-[#1d1d1f]">风格参考图</span>
            <ImageSingleUpload
              image={styleImage}
              onChange={onStyleImageChange}
              compact
              emptyLabel="将图片拖放到此处 或点击浏览"
              emptyHint="JPG、PNG、WebP，最大 10MB"
            />
          </div>

          <label className="block text-sm">
            <span className="mb-1 flex items-center justify-between text-[#1d1d1f]">
              力量
              <span className="text-xs text-[#6e6e73]">{strength.toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={strength}
              onChange={(e) =>
                onParamsChange({ ...params, strength: Number(e.target.value) })
              }
              className="w-full"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function buildGenerativeSubmitParams(opts: {
  imageCount: string;
  seed: string;
  aspect: string;
  params: Record<string, unknown>;
  styleImage: string | null;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...opts.params,
    stream: false,
    watermark: false,
  };
  const aspectSize = SEEDREAM_ASPECT_TO_SIZE[opts.aspect];
  if (aspectSize) out.size = aspectSize;
  if (opts.seed.trim()) out.seed = Number(opts.seed);
  if (opts.imageCount !== "1") out.n = Number(opts.imageCount);
  if (opts.styleImage) out.styleImageDataUrl = opts.styleImage;
  return out;
}
