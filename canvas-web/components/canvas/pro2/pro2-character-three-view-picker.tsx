"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, SlidersHorizontal, Users, X } from "lucide-react";
import { parseCharacterRows } from "@/lib/canvas/parse-md-tables";
import {
  pickDefaultPro2ThreeViewImageEngine,
  type Pro2ThreeViewBatchImagePick,
} from "@/lib/canvas/pro2-three-view-batch-image";
import {
  pro2ThreeViewAsSbv1Settings,
  sbv1EngineToBatchImage,
} from "@/lib/canvas/pro2-three-view-engine";
import { PRO2_DOCK_BORDER, PRO2_DOCK_SHELL_BG } from "@/lib/canvas/story-pro2-node-chrome";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { cn } from "@/lib/utils";
import {
  Sbv1ImageGenerateSettingsModal,
  sbv1ImageSettingsTriggerLabel,
} from "../sbv1/sbv1-image-generate-settings-modal";

export type Pro2CharacterThreeViewResult = {
  characterKeys: string[];
  batchImage: Pro2ThreeViewBatchImagePick;
};

export type Pro2CharacterThreeViewPickerProps = {
  open: boolean;
  characterMd: string;
  initialBatchImage?: Pro2ThreeViewBatchImagePick | null;
  onClose: () => void;
  onConfirm: (result: Pro2CharacterThreeViewResult) => void;
};

function cellText(value: string | undefined, fallback = "—"): string {
  const t = (value ?? "").trim();
  return t || fallback;
}

const GRID_HEAD =
  "grid grid-cols-[28px_minmax(72px,0.8fr)_minmax(88px,1fr)_minmax(140px,1.6fr)_minmax(100px,1fr)] gap-x-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-white/40";

const GRID_ROW =
  "grid grid-cols-[28px_minmax(72px,0.8fr)_minmax(88px,1fr)_minmax(140px,1.6fr)_minmax(100px,1fr)] gap-x-2 px-3 py-2.5";

const NESTED_SETTINGS_Z = 1300;

/** 生成角色三视图 · 选择角色 + 与 2.0 图片节点一致的模型设置 */
export function Pro2CharacterThreeViewPicker({
  open,
  characterMd,
  initialBatchImage,
  onClose,
  onConfirm,
}: Pro2CharacterThreeViewPickerProps) {
  const { providers } = useUserProviders();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsData, setSettingsData] = useState<Sbv1ImageNodeData>({
    aspectRatio: "16:9",
    imageQuality: "standard",
    resolution: "2K",
    outputCount: 1,
  });

  const rows = useMemo(() => parseCharacterRows(characterMd), [characterMd]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(rows.map((r) => r.name)));
    const seedBatch =
      initialBatchImage ??
      pickDefaultPro2ThreeViewImageEngine(providers) ??
      null;
    setSettingsData(
      pro2ThreeViewAsSbv1Settings(
        {
          aspectRatio: "16:9",
          imageQuality: "standard",
          resolution: "2K",
          outputCount: 1,
        },
        seedBatch,
      ),
    );
    setSettingsOpen(false);
  }, [open, rows, initialBatchImage, providers]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open || !rows.length) return null;

  const allSelected = selected.size === rows.length;
  const checked = rows.filter((r) => selected.has(r.name));
  const batchImage = sbv1EngineToBatchImage(settingsData);
  const hasImageModel = Boolean(batchImage);
  const settingsLabel = sbv1ImageSettingsTriggerLabel(settingsData, providers);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            borderColor: PRO2_DOCK_BORDER,
            background: PRO2_DOCK_SHELL_BG,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-violet-200/80" />
              <p className="text-[14px] font-medium text-white/90">
                选择要生成三视图的角色
              </p>
            </div>
            <button
              type="button"
              className="nodrag rounded-md p-1.5 text-white/45 hover:bg-white/8"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-2">
            <button
              type="button"
              className="text-[11px] text-violet-200/80 hover:text-violet-100"
              onClick={() =>
                setSelected(
                  allSelected ? new Set() : new Set(rows.map((r) => r.name)),
                )
              }
            >
              {allSelected ? "取消全选" : "全选"}
            </button>
            <span className="text-[11px] text-white/45">
              已选 {checked.length} / {rows.length} 角色
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <div
              className={cn(
                GRID_HEAD,
                "sticky top-0 z-[1] border-b border-white/[0.06] bg-[#1a1a22]",
              )}
            >
              <span />
              <span>角色</span>
              <span>定位</span>
              <span>外貌 / 服装</span>
              <span>性格</span>
            </div>
            <ul>
              {rows.map((row) => {
                const on = selected.has(row.name);
                return (
                  <li
                    key={row.name}
                    className={cn(
                      "border-b border-white/[0.04] transition hover:bg-white/[0.03]",
                      on && "bg-violet-500/[0.08]",
                    )}
                  >
                    <label className={cn(GRID_ROW, "cursor-pointer items-start")}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={on}
                        onChange={() => toggle(row.name)}
                      />
                      <span className="text-[12px] font-semibold text-white/85">
                        {row.name}
                      </span>
                      <span className="text-[11px] text-white/65">
                        {cellText(row.role)}
                      </span>
                      <span className="line-clamp-3 text-[11px] leading-snug text-white/70">
                        {cellText(row.appearance, "（无外貌描述）")}
                      </span>
                      <span className="line-clamp-2 text-[11px] leading-snug text-white/50">
                        {cellText(row.personality)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <footer className="flex flex-col gap-3 border-t border-white/[0.06] px-5 py-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
                三视图模型
              </p>
              <button
                type="button"
                className="nodrag flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 text-left text-[12px] text-white/75 transition hover:border-white/25 hover:bg-black/40"
                onClick={() => setSettingsOpen(true)}
              >
                <SlidersHorizontal className="size-3.5 shrink-0 text-white/45" />
                <span className="min-w-0 flex-1 truncate">{settingsLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 text-white/45" />
              </button>
              {!hasImageModel ? (
                <p className="mt-1 text-[10px] text-amber-200/90">
                  请先选择 IMAGE 模型后再生成
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/6"
                onClick={onClose}
              >
                取消
              </button>
              <button
                type="button"
                disabled={!checked.length || !hasImageModel}
                className="rounded-lg bg-white px-4 py-1.5 text-[12px] font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  if (!batchImage) return;
                  onConfirm({
                    characterKeys: checked.map((r) => r.name),
                    batchImage,
                  });
                  onClose();
                }}
              >
                生成 {checked.length} 个三视图
              </button>
            </div>
          </footer>
        </div>
      </div>

      <Sbv1ImageGenerateSettingsModal
        open={settingsOpen}
        data={settingsData}
        modalZIndex={NESTED_SETTINGS_Z}
        onClose={() => setSettingsOpen(false)}
        onConfirm={(patch) => {
          setSettingsData((prev) => ({ ...prev, ...patch }));
        }}
      />
    </>,
    document.body,
  );
}
