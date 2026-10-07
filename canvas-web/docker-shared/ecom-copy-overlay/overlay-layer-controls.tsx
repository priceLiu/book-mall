"use client";

import type React from "react";

import { ECOM_COPY_FONT_PRESETS, normalizeCopyFontPresetId } from "./copy-fonts";
import { resolveLayerShadow } from "./text-effects";
import type { EcomCopyOverlay, EcomCopyOverlayLayer } from "./types";

type Props = {
  overlay: EcomCopyOverlay;
  selectedLayer: EcomCopyOverlayLayer | undefined;
  onChange: (overlay: EcomCopyOverlay) => void;
  className?: string;
  variant?: "default" | "studio";
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const inputClass =
  "w-full rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/20";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-[#d2d2d7] bg-[#fafafa] p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-white text-[#1d1d1f] shadow-sm"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StudioControls({
  overlay,
  selectedLayer,
  onChange,
  className = "",
}: Omit<Props, "variant">) {
  if (!selectedLayer) {
    return (
      <p className={`text-xs text-[#86868b] ${className}`}>请在上方选中一个文案块</p>
    );
  }

  const patchLayer = (patch: Partial<EcomCopyOverlayLayer>) => {
    onChange({
      ...overlay,
      layers: overlay.layers.map((l) =>
        l.id === selectedLayer.id ? { ...l, ...patch } : l,
      ),
    });
  };

  const shadowOn = (selectedLayer.shadowBlur ?? 0) > 0;
  const glowOn = (selectedLayer.glowBlur ?? 0) > 0;
  const strokeOn = (selectedLayer.strokeWidth ?? 0) > 0;
  const textBgOn = Boolean(selectedLayer.textBgEnabled);
  const isBold = selectedLayer.fontWeight !== "normal";

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-[#6e6e73]">字号 px</span>
          <input
            type="number"
            min={12}
            max={120}
            className={`${inputClass} mt-1`}
            value={selectedLayer.fontSize}
            onChange={(e) => patchLayer({ fontSize: Number(e.target.value) || 32 })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#6e6e73]">文本框宽度 %</span>
          <input
            type="number"
            min={12}
            max={96}
            className={`${inputClass} mt-1`}
            value={Math.round((selectedLayer.maxWidthNorm ?? 0.88) * 100)}
            onChange={(e) =>
              patchLayer({
                maxWidthNorm: clamp(Number(e.target.value) / 100, 0.12, 0.96),
              })
            }
          />
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-[#6e6e73]">字体</span>
        <select
          className={inputClass}
          value={normalizeCopyFontPresetId(selectedLayer.fontFamily)}
          onChange={(e) =>
            patchLayer({ fontFamily: normalizeCopyFontPresetId(e.target.value) })
          }
        >
          {ECOM_COPY_FONT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="text-xs font-medium text-[#6e6e73]">文字颜色</span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="color"
            className="size-10 shrink-0 cursor-pointer rounded-lg border border-[#d2d2d7] bg-white p-0.5"
            value={selectedLayer.color ?? "#ffffff"}
            onChange={(e) => patchLayer({ color: e.target.value })}
          />
          <span className="text-xs tabular-nums text-[#86868b]">
            {(selectedLayer.color ?? "#ffffff").toUpperCase()}
          </span>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-[#6e6e73]">对齐</span>
        <Segmented
          value={selectedLayer.textAlign ?? "center"}
          options={[
            { value: "left", label: "左" },
            { value: "center", label: "中" },
            { value: "right", label: "右" },
          ]}
          onChange={(v) => patchLayer({ textAlign: v })}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-[#6e6e73]">方向 · 字重</span>
        <div className="grid grid-cols-2 gap-2">
          <Segmented
            value={selectedLayer.writingMode === "vertical" ? "vertical" : "horizontal"}
            options={[
              { value: "horizontal", label: "横排" },
              { value: "vertical", label: "竖排" },
            ]}
            onChange={(v) =>
              patchLayer({ writingMode: v === "vertical" ? "vertical" : "horizontal" })
            }
          />
          <div className="flex rounded-lg border border-[#d2d2d7] bg-[#fafafa] p-0.5">
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                isBold ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73]"
              }`}
              onClick={() => patchLayer({ fontWeight: "bold" })}
            >
              粗体
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 text-xs font-normal transition-colors ${
                !isBold ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73]"
              }`}
              onClick={() => patchLayer({ fontWeight: "normal" })}
            >
              常规
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3">
        <p className="text-xs font-semibold text-[#1d1d1f]">文字特效</p>

        <EffectRow
          label="投影"
          checked={shadowOn}
          onToggle={(on) =>
            patchLayer(
              on
                ? { shadowBlur: 10, shadowOffsetX: 0, shadowOffsetY: 4, shadowOpacity: 0.85 }
                : { shadowBlur: 0 },
            )
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-[#6e6e73]">
              模糊
              <input
                type="number"
                min={1}
                max={48}
                className={`${inputClass} mt-1`}
                value={selectedLayer.shadowBlur ?? 10}
                onChange={(e) =>
                  patchLayer({ shadowBlur: clamp(Number(e.target.value) || 10, 1, 48) })
                }
              />
            </label>
            <label className="block text-xs text-[#6e6e73]">
              偏移 X
              <input
                type="number"
                min={-32}
                max={32}
                className={`${inputClass} mt-1`}
                value={selectedLayer.shadowOffsetX ?? 0}
                onChange={(e) =>
                  patchLayer({ shadowOffsetX: clamp(Number(e.target.value) || 0, -32, 32) })
                }
              />
            </label>
            <label className="block text-xs text-[#6e6e73]">
              偏移 Y
              <input
                type="number"
                min={0}
                max={32}
                className={`${inputClass} mt-1`}
                value={selectedLayer.shadowOffsetY ?? 4}
                onChange={(e) =>
                  patchLayer({ shadowOffsetY: clamp(Number(e.target.value) || 0, 0, 32) })
                }
              />
            </label>
            <label className="col-span-2 block text-xs text-[#6e6e73]">
              投影色
              <input
                type="color"
                className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-[#d2d2d7]"
                value={selectedLayer.shadowColor?.trim() || "#000000"}
                onChange={(e) => patchLayer({ shadowColor: e.target.value })}
              />
            </label>
          </div>
        </EffectRow>

        <EffectRow
          label="外发光"
          checked={glowOn}
          onToggle={(on) => patchLayer(on ? { glowBlur: 12, glowOpacity: 0.85 } : { glowBlur: 0 })}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-[#6e6e73]">
              强度
              <input
                type="number"
                min={1}
                max={48}
                className={`${inputClass} mt-1`}
                value={selectedLayer.glowBlur ?? 12}
                onChange={(e) =>
                  patchLayer({ glowBlur: clamp(Number(e.target.value) || 12, 1, 48) })
                }
              />
            </label>
            <label className="block text-xs text-[#6e6e73]">
              发光色
              <input
                type="color"
                className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-[#d2d2d7]"
                value={selectedLayer.glowColor?.trim() || "#ffffff"}
                onChange={(e) => patchLayer({ glowColor: e.target.value })}
              />
            </label>
          </div>
        </EffectRow>

        <EffectRow
          label="描边"
          checked={strokeOn}
          onToggle={(on) =>
            patchLayer(on ? { strokeWidth: 2, strokeColor: "#000000" } : { strokeWidth: 0 })
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-[#6e6e73]">
              粗细 px
              <input
                type="number"
                min={1}
                max={12}
                className={`${inputClass} mt-1`}
                value={selectedLayer.strokeWidth ?? 2}
                onChange={(e) =>
                  patchLayer({ strokeWidth: clamp(Number(e.target.value) || 2, 1, 12) })
                }
              />
            </label>
            <label className="block text-xs text-[#6e6e73]">
              描边色
              <input
                type="color"
                className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-[#d2d2d7]"
                value={selectedLayer.strokeColor?.trim() || "#000000"}
                onChange={(e) => patchLayer({ strokeColor: e.target.value })}
              />
            </label>
          </div>
        </EffectRow>

        <EffectRow
          label="字底衬底"
          checked={textBgOn}
          onToggle={(on) =>
            patchLayer(
              on
                ? {
                    textBgEnabled: true,
                    textBgColor: "#000000",
                    textBgOpacity: 0.5,
                    textBgPaddingPx: 10,
                  }
                : { textBgEnabled: false },
            )
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-[#6e6e73]">
              内边距
              <input
                type="number"
                min={0}
                max={32}
                className={`${inputClass} mt-1`}
                value={selectedLayer.textBgPaddingPx ?? 10}
                onChange={(e) =>
                  patchLayer({
                    textBgPaddingPx: clamp(Number(e.target.value) || 10, 0, 32),
                  })
                }
              />
            </label>
            <label className="block text-xs text-[#6e6e73]">
              不透明度
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className={`${inputClass} mt-1`}
                value={selectedLayer.textBgOpacity ?? 0.5}
                onChange={(e) =>
                  patchLayer({
                    textBgOpacity: clamp(Number(e.target.value) || 0.5, 0, 1),
                  })
                }
              />
            </label>
            <label className="col-span-2 block text-xs text-[#6e6e73]">
              底色
              <input
                type="color"
                className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-[#d2d2d7]"
                value={selectedLayer.textBgColor?.trim() || "#000000"}
                onChange={(e) => patchLayer({ textBgColor: e.target.value })}
              />
            </label>
          </div>
        </EffectRow>
      </div>
    </div>
  );
}

function EffectRow({
  label,
  checked,
  onToggle,
  children,
}: {
  label: string;
  checked: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#e8e8ed] bg-white p-2.5">
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#424245]">{label}</span>
        <input
          type="checkbox"
          className="size-4 rounded border-[#d2d2d7] accent-[#0071e3]"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </label>
      {checked ? <div className="mt-2 border-t border-[#f0f0f2] pt-2">{children}</div> : null}
    </div>
  );
}

export function EcomCopyOverlayLayerControls({
  overlay,
  selectedLayer,
  onChange,
  className = "",
  variant = "default",
}: Props) {
  if (variant === "studio") {
    return (
      <StudioControls
        overlay={overlay}
        selectedLayer={selectedLayer}
        onChange={onChange}
        className={className}
      />
    );
  }

  if (!selectedLayer) return null;

  const patchLayer = (patch: Partial<EcomCopyOverlayLayer>) => {
    onChange({
      ...overlay,
      layers: overlay.layers.map((l) =>
        l.id === selectedLayer.id ? { ...l, ...patch } : l,
      ),
    });
  };

  return (
    <div className={`grid grid-cols-2 gap-2 text-xs ${className}`}>
      <label className="text-[#6e6e73]">
        文本框宽度（占图宽 %）
        <input
          type="number"
          min={12}
          max={96}
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={Math.round((selectedLayer.maxWidthNorm ?? 0.88) * 100)}
          onChange={(e) =>
            patchLayer({
              maxWidthNorm: clamp(Number(e.target.value) / 100, 0.12, 0.96),
            })
          }
        />
      </label>
      <label className="text-[#6e6e73]">
        字号（成图像素）
        <input
          type="number"
          min={12}
          max={120}
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={selectedLayer.fontSize}
          onChange={(e) => patchLayer({ fontSize: Number(e.target.value) || 32 })}
        />
      </label>
      <label className="text-[#6e6e73]">
        颜色
        <input
          type="color"
          className="mt-0.5 h-8 w-full cursor-pointer rounded border border-[#d2d2d7]"
          value={selectedLayer.color ?? "#ffffff"}
          onChange={(e) => patchLayer({ color: e.target.value })}
        />
      </label>
      <label className="col-span-2 text-[#6e6e73]">
        排版方向
        <select
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={selectedLayer.writingMode ?? "horizontal"}
          onChange={(e) =>
            patchLayer({
              writingMode: e.target.value === "vertical" ? "vertical" : "horizontal",
            })
          }
        >
          <option value="horizontal">横排</option>
          <option value="vertical">竖排</option>
        </select>
      </label>
      <label className="text-[#6e6e73]">
        对齐
        <select
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={selectedLayer.textAlign ?? "center"}
          onChange={(e) =>
            patchLayer({
              textAlign: e.target.value as "left" | "center" | "right",
            })
          }
        >
          <option value="left">左</option>
          <option value="center">中</option>
          <option value="right">右</option>
        </select>
      </label>
      <label className="text-[#6e6e73]">
        字重
        <select
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={selectedLayer.fontWeight === "normal" ? "normal" : "bold"}
          onChange={(e) =>
            patchLayer({
              fontWeight: e.target.value === "normal" ? "normal" : "bold",
            })
          }
        >
          <option value="bold">粗体</option>
          <option value="normal">常规</option>
        </select>
      </label>
      <label className="col-span-2 flex items-center gap-2 text-[#6e6e73]">
        <input
          type="checkbox"
          className="size-4 rounded border-[#d2d2d7]"
          checked={resolveLayerShadow(selectedLayer) != null}
          onChange={(e) => {
            if (e.target.checked) {
              patchLayer({
                shadowBlur: selectedLayer.shadowBlur === 0 ? 8 : (selectedLayer.shadowBlur ?? 8),
              });
            } else {
              patchLayer({ shadowBlur: 0 });
            }
          }}
        />
        文字投影
      </label>
      {resolveLayerShadow(selectedLayer) ? (
        <>
          <label className="text-[#6e6e73]">
            投影模糊
            <input
              type="number"
              min={1}
              max={48}
              className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
              value={selectedLayer.shadowBlur ?? 8}
              onChange={(e) =>
                patchLayer({ shadowBlur: clamp(Number(e.target.value) || 8, 1, 48) })
              }
            />
          </label>
          <label className="text-[#6e6e73]">
            投影颜色
            <input
              type="color"
              className="mt-0.5 h-8 w-full cursor-pointer rounded border border-[#d2d2d7]"
              value={selectedLayer.shadowColor?.trim() || "#000000"}
              onChange={(e) => patchLayer({ shadowColor: e.target.value })}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
