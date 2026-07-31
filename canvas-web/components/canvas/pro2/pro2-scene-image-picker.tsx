"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, X } from "lucide-react";
import type { StoryProSceneRow } from "@/lib/canvas/story-pro-workspace-types";
import { parseSceneVisualDictionaryRows } from "@/lib/canvas/parse-md-tables";
import {
  pickDefaultPro2SceneImageEngine,
  PRO2_SCENE_IMAGE_MODEL_KEYS,
  type Pro2SceneBatchImagePick,
} from "@/lib/canvas/pro2-scene-batch-image";
import {
  pro2BatchImageAsSbv1Settings,
  sbv1EngineToBatchImage,
} from "@/lib/canvas/pro2-three-view-engine";
import { PRO2_DOCK_BORDER, PRO2_DOCK_SHELL_BG } from "@/lib/canvas/story-pro2-node-chrome";
import {
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import {
  LIBTV_DOCK_TOOLBAR_SCREEN_SCALE,
  LibtvDockToolbarMetricsContext,
} from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { cn } from "@/lib/utils";
import {
  Sbv1ImageDockModelPicker,
  Sbv1ImageDockParamsPicker,
} from "../sbv1/sbv1-image-dock-pickers";

export type Pro2SceneImageResult = {
  sceneKeys: string[];
  batchImage: Pro2SceneBatchImagePick;
};

export type Pro2SceneImagePickerProps = {
  open: boolean;
  sceneMd: string;
  /** 与 hub sceneRows 同步的结构化行（优先于 sceneMd 解析） */
  sceneRows?: StoryProSceneRow[];
  /** 与场景列一致的 hub 前缀 row key（name → key） */
  sceneRowKeys?: { name: string; key: string }[];
  initialBatchImage?: Pro2SceneBatchImagePick | null;
  onClose: () => void;
  onConfirm: (result: Pro2SceneImageResult) => void;
};

type ScenePickerRow = {
  key: string;
  name: string;
  environment: string;
  time: string;
  mood: string;
  imageKeywords: string;
};

function cellText(value: string | undefined, fallback = "—"): string {
  const t = (value ?? "").trim();
  return t || fallback;
}

const GRID_HEAD =
  "grid grid-cols-[28px_minmax(72px,0.8fr)_minmax(88px,1fr)_minmax(72px,0.7fr)_minmax(72px,0.7fr)_minmax(120px,1.4fr)] gap-x-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-white/40";

const GRID_ROW =
  "grid grid-cols-[28px_minmax(72px,0.8fr)_minmax(88px,1fr)_minmax(72px,0.7fr)_minmax(72px,0.7fr)_minmax(120px,1.4fr)] gap-x-2 px-3 py-2.5";

/** 生成场景图 · 选择场景 + 与三视图一致的 Dock 模型/参数 */
export function Pro2SceneImagePicker({
  open,
  sceneMd,
  sceneRows,
  sceneRowKeys,
  initialBatchImage,
  onClose,
  onConfirm,
}: Pro2SceneImagePickerProps) {
  const { providers } = useUserProviders();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);
  const [settingsData, setSettingsData] = useState<Sbv1ImageNodeData>({
    aspectRatio: "16:9",
    imageQuality: "standard",
    resolution: "2K",
    outputCount: 1,
  });

  const rows = useMemo((): ScenePickerRow[] => {
    if (sceneRows?.length) {
      return sceneRows.map((r) => ({
        key: r.key,
        name: r.name,
        environment: r.environment?.trim() ?? "",
        time: r.time?.trim() ?? "",
        mood: r.mood?.trim() ?? "",
        imageKeywords: r.imageKeywords?.trim() ?? "",
      }));
    }
    const keyByName = new Map<string, string>();
    for (const r of sceneRowKeys ?? []) {
      const name = r.name.trim();
      if (name && r.key.trim()) keyByName.set(name, r.key.trim());
    }
    return parseSceneVisualDictionaryRows(sceneMd).map((r) => ({
      key: keyByName.get(r.name.trim()) ?? r.name.trim(),
      name: r.name,
      environment: r.environment,
      time: r.time,
      mood: r.mood,
      imageKeywords: r.imageKeywords,
    }));
  }, [sceneRows, sceneMd, sceneRowKeys]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(rows.map((r) => r.key)));
    const seedBatch =
      initialBatchImage ?? pickDefaultPro2SceneImageEngine(providers) ?? null;
    setSettingsData(
      pro2BatchImageAsSbv1Settings(seedBatch, {
        aspectRatio: "16:9",
        imageQuality: "standard",
        resolution: "2K",
        outputCount: 1,
      }),
    );
    setDockMenu(null);
  }, [open, rows, initialBatchImage, providers]);

  const modalActive = open && rows.length > 0;
  useModalBodyScrollLock(modalActive);
  useModalEscapeClose(onClose, { active: modalActive });

  const patchSettings = useCallback((patch: Partial<Sbv1ImageNodeData>) => {
    setSettingsData((prev) => ({ ...prev, ...patch }));
  }, []);

  if (!mounted || !open || !rows.length) return null;

  const allSelected = selected.size === rows.length;
  const checked = rows.filter((r) => selected.has(r.key));
  const batchImage = sbv1EngineToBatchImage(settingsData);
  const hasImageModel = Boolean(batchImage);

  const toggle = (rowKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  return createPortal(
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
            <MapPin className="size-4 text-violet-200/80" />
            <p className="text-[14px] font-medium text-white/90">
              选择要生成场景图的场景
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
                allSelected ? new Set() : new Set(rows.map((r) => r.key)),
              )
            }
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
          <span className="text-[11px] text-white/45">
            已选 {checked.length} / {rows.length} 场景
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
            <span>场景</span>
            <span>环境</span>
            <span>时间</span>
            <span>气氛</span>
            <span>生图关键词</span>
          </div>
          <ul>
            {rows.map((row) => {
              const on = selected.has(row.key);
              return (
                <li
                  key={row.key}
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
                      onChange={() => toggle(row.key)}
                    />
                    <span className="text-[12px] font-semibold text-white/85">
                      {row.name}
                    </span>
                    <span className="text-[11px] text-white/65">
                      {cellText(row.environment)}
                    </span>
                    <span className="text-[11px] text-white/65">
                      {cellText(row.time)}
                    </span>
                    <span className="text-[11px] text-white/65">
                      {cellText(row.mood)}
                    </span>
                    <span className="line-clamp-3 text-[11px] leading-snug text-white/70">
                      {cellText(row.imageKeywords, "（无关键词）")}
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
              场景图模型
            </p>
            <LibtvDockToolbarMetricsContext.Provider
              value={LIBTV_DOCK_TOOLBAR_SCREEN_SCALE}
            >
              <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-black/25 px-1 py-1">
                <Sbv1ImageDockModelPicker
                  data={settingsData}
                  allowedModelKeys={PRO2_SCENE_IMAGE_MODEL_KEYS}
                  open={dockMenu === "model"}
                  onOpenChange={(next) => setDockMenu(next ? "model" : null)}
                  onPatch={patchSettings}
                />
                <Sbv1ImageDockParamsPicker
                  data={settingsData}
                  open={dockMenu === "params"}
                  onOpenChange={(next) => setDockMenu(next ? "params" : null)}
                  onPatch={patchSettings}
                />
              </div>
            </LibtvDockToolbarMetricsContext.Provider>
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
                  sceneKeys: checked.map((r) => r.key),
                  batchImage,
                });
                onClose();
              }}
            >
              生成 {checked.length} 张场景图
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
