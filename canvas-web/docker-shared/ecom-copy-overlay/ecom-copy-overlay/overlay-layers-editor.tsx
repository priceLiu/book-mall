"use client";

import type { EcomCopyOverlay } from "./types";
import { EcomCopyOverlayMultiLineText } from "./copy-textarea";
import {
  addOverlayTextLayer,
  layerListLabel,
  patchOverlayLayerText,
  removeOverlayLayer,
} from "./layer-ops";

export type EcomCopyOverlayLayersEditorProps = {
  overlay: EcomCopyOverlay;
  onChange: (overlay: EcomCopyOverlay) => void;
  selectedLayerId: string | null;
  onSelectLayerId: (id: string) => void;
  disabled?: boolean;
  /** 恢复 AI 文案到当前选中层（通常 main） */
  aiCopyRestore?: string;
  onRestoreAiCopy?: () => void;
  variant?: "light" | "dark";
  /** studio：横向胶囊列表，适合全屏排版侧栏 */
  layout?: "stack" | "studio";
};

export function EcomCopyOverlayLayersEditor({
  overlay,
  onChange,
  selectedLayerId,
  onSelectLayerId,
  disabled = false,
  aiCopyRestore,
  onRestoreAiCopy,
  variant = "light",
  layout = "stack",
}: EcomCopyOverlayLayersEditorProps) {
  const selected =
    overlay.layers.find((l) => l.id === selectedLayerId) ?? overlay.layers[0] ?? null;
  const selectedId = selected?.id ?? null;
  const isDark = variant === "dark";

  const listBtn = (active: boolean) =>
    isDark
      ? active
        ? "border-violet-500 bg-violet-500/20 text-white"
        : "border-white/15 bg-black/30 text-white/80 hover:bg-white/10"
      : active
        ? "border-[#0071e3] bg-[#f0f6ff] text-[#1d1d1f]"
        : "border-[#e8e8ed] bg-white text-[#6e6e73] hover:bg-[#fafafa]";

  const actionBtn = isDark
    ? "rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
    : "rounded-lg border border-[#d2d2d7] px-2.5 py-1 text-xs text-[#424245] hover:bg-[#fafafa] disabled:opacity-40";

  const layerChip = (active: boolean) =>
    isDark
      ? active
        ? "border-violet-400 bg-violet-500/25 text-white"
        : "border-white/15 bg-black/20 text-white/75 hover:bg-white/10"
      : active
        ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
        : "border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[#d2d2d7]";

  return (
    <div className="space-y-3">
      {layout === "stack" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-medium ${isDark ? "text-white/60" : "text-[#6e6e73]"}`}>
            文案块（点击选中 · 左侧拖拽定位）
          </span>
          <button
            type="button"
            className={actionBtn}
            disabled={disabled}
            onClick={() => {
              const { overlay: next, layerId } = addOverlayTextLayer(overlay);
              onChange(next);
              onSelectLayerId(layerId);
            }}
          >
            + 添加文案块
          </button>
          <button
            type="button"
            className={actionBtn}
            disabled={disabled || overlay.layers.length <= 1 || !selectedId}
            onClick={() => {
              if (!selectedId) return;
              const next = removeOverlayLayer(overlay, selectedId);
              onChange(next);
              const fallback = next.layers[0]?.id;
              if (fallback) onSelectLayerId(fallback);
            }}
          >
            删除当前块
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${isDark ? actionBtn : "border-[#d2d2d7] bg-white text-[#424245] hover:bg-[#fafafa] disabled:opacity-40"}`}
            disabled={disabled}
            onClick={() => {
              const { overlay: next, layerId } = addOverlayTextLayer(overlay);
              onChange(next);
              onSelectLayerId(layerId);
            }}
          >
            + 新块
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${isDark ? actionBtn : "border-[#e8e8ed] bg-[#fafafa] text-[#6e6e73] hover:bg-white disabled:opacity-40"}`}
            disabled={disabled || overlay.layers.length <= 1 || !selectedId}
            onClick={() => {
              if (!selectedId) return;
              const next = removeOverlayLayer(overlay, selectedId);
              onChange(next);
              const fallback = next.layers[0]?.id;
              if (fallback) onSelectLayerId(fallback);
            }}
          >
            删除
          </button>
        </div>
      )}
      {layout === "studio" ? (
        <div className="flex flex-wrap gap-1.5">
          {overlay.layers.map((layer, index) => {
            const active = layer.id === selectedId;
            return (
              <button
                key={layer.id}
                type="button"
                disabled={disabled}
                className={`max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${layerChip(active)}`}
                onClick={() => onSelectLayerId(layer.id)}
                title={layer.text.trim() || layerListLabel(layer, index)}
              >
                {layerListLabel(layer, index)}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {overlay.layers.map((layer, index) => {
            const active = layer.id === selectedId;
            return (
              <li key={layer.id}>
                <button
                  type="button"
                  disabled={disabled}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${listBtn(active)}`}
                  onClick={() => onSelectLayerId(layer.id)}
                >
                  {layerListLabel(layer, index)}
                  <span className="mt-0.5 block opacity-70">
                    字号 {layer.fontSize}px ·{" "}
                    {layer.textAlign === "left"
                      ? "左对齐"
                      : layer.textAlign === "right"
                        ? "右对齐"
                        : "居中"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected ? (
        <EcomCopyOverlayMultiLineText
          label={
            layout === "studio"
              ? "文案内容"
              : `编辑「${layerListLabel(selected, overlay.layers.indexOf(selected))}」`
          }
          value={selected.text}
          disabled={disabled}
          onChange={(text) => {
            if (!selectedId) return;
            onChange(patchOverlayLayerText(overlay, selectedId, text));
          }}
          hint={
            layout === "studio"
              ? "Enter 换行；左侧画布拖拽定位。"
              : "每块文案独立位置与字号；左侧点选块后拖拽。块内 Enter 仍可换行。"
          }
          labelClassName={isDark ? "block text-xs text-white/60" : undefined}
          textareaClassName={
            isDark
              ? "mt-1 min-h-[7.5rem] max-h-[min(14rem,32vh)] w-full resize-y rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm leading-relaxed text-white outline-none focus:border-white/30 whitespace-pre-wrap"
              : undefined
          }
          hintClassName={isDark ? "text-[11px] leading-relaxed text-white/45" : undefined}
        />
      ) : null}
      {aiCopyRestore?.trim() && onRestoreAiCopy ? (
        <button
          type="button"
          disabled={disabled}
          className={actionBtn}
          onClick={onRestoreAiCopy}
        >
          恢复 AI 文案到当前块
        </button>
      ) : null}
    </div>
  );
}
