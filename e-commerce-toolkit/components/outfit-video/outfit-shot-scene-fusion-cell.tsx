"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { fetchEcomSceneLibraryCatalog } from "@/lib/ecom-scene-library-api";
import type { EcomSceneLibraryEntry } from "@/lib/ecom-scene-library/types";
import type { OutfitSceneFusionMode } from "@/lib/ecom-outfit-video-api";
import type { SceneShot } from "@/lib/video-workflow/shot-spine";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: Array<{ id: OutfitSceneFusionMode; label: string; hint: string }> = [
  {
    id: "follow_reference",
    label: "跟随原视频",
    hint: "读取本镜拆镜光影/场景描述",
  },
  {
    id: "library",
    label: "场景库",
    hint: "从姿势·场景·道具库选择",
  },
  {
    id: "upload_ref",
    label: "上传参考图",
    hint: "上传场景图与人物融图",
  },
];

function modeLabel(mode?: OutfitSceneFusionMode): string {
  return MODE_OPTIONS.find((m) => m.id === mode)?.label ?? "未设置";
}

type Props = {
  shot: SceneShot;
  disabled?: boolean;
  fusing?: boolean;
  fusionModelKey: string;
  onPickMode: (
    index: number,
    mode: OutfitSceneFusionMode,
    libraryEntryId?: string,
  ) => Promise<void>;
  onUploadSceneRef: (index: number, file: File) => Promise<void>;
  onFuse: (index: number) => Promise<void>;
};

export function OutfitShotSceneFusionCell({
  shot,
  disabled,
  fusing,
  fusionModelKey,
  onPickMode,
  onUploadSceneRef,
  onFuse,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalog, setCatalog] = useState<EcomSceneLibraryEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const fusion = shot.sceneFusion;
  const fusedUrl = fusion?.fusedImageUrl?.trim();
  const busy = Boolean(disabled || fusing);

  useEffect(() => {
    if (!pickerOpen || catalog.length > 0) return;
    setCatalogLoading(true);
    void fetchEcomSceneLibraryCatalog()
      .then((c) => setCatalog(c.scenes ?? []))
      .finally(() => setCatalogLoading(false));
  }, [catalog.length, pickerOpen]);

  const subtitle = useMemo(() => {
    if (fusion?.sharedFromShotIndex) {
      return `共用镜 ${fusion.sharedFromShotIndex}`;
    }
    if (fusion?.mode === "library" && fusion.libraryEntryName) {
      return fusion.libraryEntryName;
    }
    if (fusion?.mode === "follow_reference") return "原视频场景";
    if (fusion?.mode === "upload_ref") return "自定义参考图";
    return "点击选择场景";
  }, [fusion]);

  return (
    <div className="relative flex min-w-[9rem] flex-col gap-1.5">
      <div className="relative aspect-[9/16] w-14 overflow-hidden rounded-md border border-[#e8e8ed] bg-[#fafafa]">
        {fusedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fusedUrl} alt="场景融合图" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-1 text-center text-[9px] leading-tight text-[#86868b]">
            场景图
          </div>
        )}
        {fusing ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-4 w-4 animate-spin text-[#0071e3]" />
          </div>
        ) : null}
      </div>
      <p className="max-w-[9rem] truncate text-[10px] text-[#6e6e73]" title={subtitle}>
        {modeLabel(fusion?.mode)}
        {subtitle !== modeLabel(fusion?.mode) ? ` · ${subtitle}` : ""}
      </p>
      <div className="flex flex-wrap gap-1">
        <EcomButtonSecondary
          type="button"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={busy}
          onClick={() => setPickerOpen((v) => !v)}
        >
          选场景
        </EcomButtonSecondary>
        <EcomButtonSecondary
          type="button"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={busy || !fusion?.mode}
          onClick={() => void onFuse(shot.index)}
        >
          融图
        </EcomButtonSecondary>
      </div>

      {pickerOpen ? (
        <div className="absolute z-30 mt-1 w-56 rounded-lg border border-[#e8e8ed] bg-white p-2 shadow-lg">
          <p className="mb-1 text-[10px] font-medium text-[#6e6e73]">场景来源</p>
          <div className="space-y-1">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={cn(
                  "w-full rounded-md border px-2 py-1.5 text-left text-[11px]",
                  fusion?.mode === opt.id
                    ? "border-[#0071e3] bg-[#f0f6ff]"
                    : "border-[#e8e8ed] hover:border-[#d2d2d7]",
                )}
                disabled={busy}
                onClick={() => {
                  if (opt.id === "upload_ref") {
                    fileRef.current?.click();
                    setPickerOpen(false);
                    return;
                  }
                  void onPickMode(shot.index, opt.id).then(() => setPickerOpen(false));
                }}
              >
                <span className="font-medium text-[#1d1d1f]">{opt.label}</span>
                <span className="mt-0.5 block text-[10px] text-[#86868b]">{opt.hint}</span>
              </button>
            ))}
          </div>
          {catalogLoading ? (
            <p className="mt-2 text-[10px] text-[#86868b]">加载场景库…</p>
          ) : catalog.length > 0 ? (
            <div className="mt-2 max-h-36 space-y-1 overflow-y-auto border-t border-[#e8e8ed] pt-2">
              <p className="text-[10px] font-medium text-[#6e6e73]">场景库快捷选择</p>
              {catalog.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-[#0071e3] hover:bg-[#f0f6ff]"
                  disabled={busy}
                  onClick={() => {
                    void onPickMode(shot.index, "library", entry.id).then(() =>
                      setPickerOpen(false),
                    );
                  }}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[9px] leading-relaxed text-[#86868b]">
            融图模型：{fusionModelKey}
          </p>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUploadSceneRef(shot.index, f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
