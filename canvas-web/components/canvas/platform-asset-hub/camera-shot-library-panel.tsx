"use client";

import { useMemo, useState } from "react";
import { Copy, PanelRightOpen } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  buildCameraShotRunPrompt,
  CAMERA_SHOT_PRESETS,
  type CameraShotPreset,
} from "@/lib/canvas/camera-shot-library/catalog";
import { cn } from "@/lib/utils";

const ICON_BTN =
  "flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow-md transition hover:scale-105 hover:bg-white";

export function CameraShotLibraryPanel({
  onInsertToDock,
}: {
  /** 有聚焦 Dock 时插入 @<cam:…> */
  onInsertToDock?: (preset: CameraShotPreset, combinedPrompt: string) => void;
}) {
  const { alert } = useDialogs();
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return CAMERA_SHOT_PRESETS;
    return CAMERA_SHOT_PRESETS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.meaningZh.toLowerCase().includes(q) ||
        p.sceneExampleZh.toLowerCase().includes(q),
    );
  }, [keyword]);

  const copyCombined = async (preset: CameraShotPreset) => {
    const text = buildCameraShotRunPrompt(preset, preset.sceneExampleZh);
    try {
      await navigator.clipboard.writeText(text);
      await alert({
        variant: "success",
        title: "已复制组合 prompt",
        message: `「${preset.name}」画面示例 + 英文运镜已写入剪贴板，请按场景改写画面部分。`,
      });
    } catch {
      await alert({
        variant: "error",
        title: "复制失败",
        message: "请手动选中卡片内英文运镜复制。",
      });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-[11px] text-white/45">
        平台镜头描述库 · 中文释义仅供理解，不进模型；生成时使用「画面描述 + 英文运镜」。
      </p>
      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索镜头名称或释义…"
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
      />
      <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {filtered.map((preset) => (
          <li
            key={preset.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-white">
                {preset.index}. {preset.name}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={ICON_BTN}
                  aria-label="复制组合 prompt"
                  title="复制组合 prompt"
                  onClick={() => void copyCombined(preset)}
                >
                  <Copy className="h-4 w-4" strokeWidth={2} />
                </button>
                {onInsertToDock ? (
                  <button
                    type="button"
                    className={ICON_BTN}
                    aria-label="插入 Dock"
                    title="插入 Dock"
                    onClick={() =>
                      onInsertToDock(
                        preset,
                        buildCameraShotRunPrompt(preset, preset.sceneExampleZh),
                      )
                    }
                  >
                    <PanelRightOpen className="h-4 w-4" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            </div>
            <p
              className={cn(
                "mt-2 line-clamp-[14] whitespace-pre-wrap text-[10px] leading-relaxed text-white/60",
              )}
            >
              {preset.meaningZh}
              {"\n\n画面示例："}
              {preset.sceneExampleZh}
              {"\n\n"}
              <span className="font-mono text-white/70">{preset.cameraPromptEn}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
