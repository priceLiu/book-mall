"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  buildCameraShotRunPrompt,
  CAMERA_SHOT_PRESETS,
  type CameraShotPreset,
} from "@/lib/canvas/camera-shot-library/catalog";
import { cn } from "@/lib/utils";

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
              <div>
                <p className="text-xs font-medium text-white">
                  {preset.index}. {preset.name}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] text-white/45">
                  {preset.meaningZh}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rounded-md border border-white/15 px-2 py-1 text-[10px] text-white/80 hover:bg-white/5"
                  onClick={() => void copyCombined(preset)}
                >
                  <Copy className="mr-0.5 inline size-3" />
                  复制
                </button>
                {onInsertToDock ? (
                  <button
                    type="button"
                    className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/20"
                    onClick={() =>
                      onInsertToDock(
                        preset,
                        buildCameraShotRunPrompt(preset, preset.sceneExampleZh),
                      )
                    }
                  >
                    插入 Dock
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-white/55">
              画面示例：{preset.sceneExampleZh}
            </p>
            <p className={cn("mt-1 font-mono text-[10px] leading-snug text-white/70")}>
              {preset.cameraPromptEn}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
