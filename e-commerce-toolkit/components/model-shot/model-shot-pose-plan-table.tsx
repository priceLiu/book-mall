"use client";

import { BookOpen, Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  EcomCatalogPickerDialog,
  type CatalogPickerEntry,
} from "@/components/model-shot/ecom-catalog-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { fetchEcomPropLibraryCatalog } from "@/lib/ecom-prop-library-api";
import type { EcomPropLibraryEntry } from "@/lib/ecom-prop-library/types";
import { fetchEcomSceneLibraryCatalog } from "@/lib/ecom-scene-library-api";
import type { EcomSceneLibraryEntry } from "@/lib/ecom-scene-library/types";
import type { ModelShotPlan, ModelShotPoseItem } from "@/lib/model-shot-types";

export type PoseItemPatch = {
  poseDescription: string;
  sceneText: string;
  propText: string;
  sceneCatalogId?: string | null;
  propCatalogId?: string | null;
  applySceneToAll?: boolean;
  applyPropToAll?: boolean;
};

type Props = {
  plan: ModelShotPlan;
  defaultSceneLabel?: string | null;
  onPatchItem: (index: number, patch: PoseItemPatch) => Promise<void>;
  onConfirmPlan: () => Promise<void>;
  onGeneratePoses: () => Promise<void>;
  busy?: boolean;
  canGeneratePoses?: boolean;
  confirmed?: boolean;
};

type PickerKind = "scene" | "prop" | null;

function displayPoseDescription(item: ModelShotPoseItem): string {
  if (item.poseDescription?.trim()) return item.poseDescription.trim();
  return item.prompt?.trim() || "—";
}

function displaySceneText(item: ModelShotPoseItem): string {
  if (item.sceneText !== undefined) return item.sceneText.trim() || "—";
  return "—";
}

function displayPropText(item: ModelShotPoseItem): string {
  if (item.propText !== undefined) return item.propText.trim() || "无";
  return "—";
}

function toDraft(item: ModelShotPoseItem): PoseItemPatch {
  return {
    poseDescription: item.poseDescription?.trim() || item.prompt?.trim() || "",
    sceneText: item.sceneText ?? "",
    propText: item.propText ?? "",
    sceneCatalogId: item.sceneCatalogId ?? null,
    propCatalogId: item.propCatalogId ?? null,
  };
}

function sceneToPickerEntry(entry: EcomSceneLibraryEntry): CatalogPickerEntry {
  return {
    id: entry.id,
    name: entry.name,
    subtitle: entry.visualPrompt,
    scope: entry.scope,
    lockedAt: entry.lockedAt,
  };
}

function propToPickerEntry(entry: EcomPropLibraryEntry): CatalogPickerEntry {
  return {
    id: entry.id,
    name: entry.name,
    subtitle: entry.visualDescription,
    scope: entry.scope,
    lockedAt: entry.lockedAt,
  };
}

export function ModelShotPosePlanTable({
  plan,
  defaultSceneLabel,
  onPatchItem,
  onConfirmPlan,
  onGeneratePoses,
  busy,
  canGeneratePoses,
  confirmed = false,
}: Props) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<PoseItemPatch>({
    poseDescription: "",
    sceneText: "",
    propText: "",
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number>(1);
  const [applyToAll, setApplyToAll] = useState(false);
  const [sceneCatalog, setSceneCatalog] = useState<EcomSceneLibraryEntry[]>([]);
  const [propCatalog, setPropCatalog] = useState<EcomPropLibraryEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const pickerEntries = useMemo((): CatalogPickerEntry[] => {
    if (pickerKind === "scene") return sceneCatalog.map(sceneToPickerEntry);
    if (pickerKind === "prop") return propCatalog.map(propToPickerEntry);
    return [];
  }, [pickerKind, sceneCatalog, propCatalog]);

  const openPicker = useCallback(
    async (kind: "scene" | "prop", index: number, all = false) => {
      setPickerKind(kind);
      setPickerTargetIndex(index);
      setApplyToAll(all);
      setCatalogLoading(true);
      setPickerOpen(true);
      try {
        if (kind === "scene") {
          const catalog = await fetchEcomSceneLibraryCatalog();
          const list = catalog.scenes.length
            ? catalog.scenes
            : [...(catalog.platform ?? []), ...(catalog.user ?? [])];
          setSceneCatalog(list);
        } else {
          const catalog = await fetchEcomPropLibraryCatalog();
          const list = catalog.props.length
            ? catalog.props
            : [...(catalog.platform ?? []), ...(catalog.user ?? [])];
          setPropCatalog(list);
        }
      } finally {
        setCatalogLoading(false);
      }
    },
    [],
  );

  const handlePickerPick = useCallback(
    async (entry: CatalogPickerEntry) => {
      if (!pickerKind) return;
      const index = pickerTargetIndex;
      const item = plan.items.find((i) => i.index === index) ?? plan.items[0];
      if (!item) return;

      if (pickerKind === "scene") {
        const scene = sceneCatalog.find((s) => s.id === entry.id);
        const sceneText = scene?.visualPrompt ?? entry.subtitle;
        if (editIndex === index) {
          setDraft((prev) => ({
            ...prev,
            sceneText,
            sceneCatalogId: entry.id,
          }));
          return;
        }
        await onPatchItem(index, {
          ...toDraft(item),
          sceneText,
          sceneCatalogId: entry.id,
          applySceneToAll: applyToAll,
        });
      } else {
        const prop = propCatalog.find((p) => p.id === entry.id);
        const propText = prop?.visualDescription ?? entry.subtitle;
        if (editIndex === index) {
          setDraft((prev) => ({
            ...prev,
            propText,
            propCatalogId: entry.id,
          }));
          return;
        }
        await onPatchItem(index, {
          ...toDraft(item),
          propText,
          propCatalogId: entry.id,
          applyPropToAll: applyToAll,
        });
      }
    },
    [applyToAll, editIndex, onPatchItem, pickerKind, pickerTargetIndex, plan.items, propCatalog, sceneCatalog],
  );

  if (plan.items.length === 0) {
    return (
      <section className="space-y-3 rounded-2xl border border-dashed border-[#d2d2d7] p-6 text-center">
        <p className="text-sm text-[#6e6e73]">完成助手采集后，可在此生成并编辑姿势方案。</p>
        {canGeneratePoses ? (
          <EcomButtonSecondary type="button" disabled={busy} onClick={() => void onGeneratePoses()}>
            生成姿势方案
          </EcomButtonSecondary>
        ) : null}
      </section>
    );
  }

  const firstIndex = plan.items[0]?.index ?? 1;

  return (
    <section className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">
            {confirmed ? "姿势脚本" : "姿势计划"}
          </h3>
          <p className="text-xs text-[#86868b]">
            共 {plan.items.length} 条 · 状态：
            {plan.status === "confirmed" ? "已确认，可逐张出图" : "待确认"}
          </p>
          {defaultSceneLabel ? (
            <p className="mt-1 text-[11px] text-[#424245]">
              默认场景：<span className="font-medium">{defaultSceneLabel}</span>
            </p>
          ) : null}
          {confirmed ? (
            <p className="mt-1 text-[11px] text-[#86868b]">
              修改并保存后，下方生成模特图将按最新脚本执行。
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <EcomButtonSecondary
            type="button"
            disabled={busy}
            onClick={() => void openPicker("scene", firstIndex, true)}
          >
            场景应用到全部
          </EcomButtonSecondary>
          <EcomButtonSecondary
            type="button"
            disabled={busy}
            onClick={() => void openPicker("prop", firstIndex, true)}
          >
            道具应用到全部
          </EcomButtonSecondary>
          <EcomButtonSecondary type="button" disabled={busy} onClick={() => void onGeneratePoses()}>
            重新生成
          </EcomButtonSecondary>
          {!confirmed && plan.status !== "confirmed" ? (
            <EcomButtonPrimary type="button" disabled={busy} onClick={() => void onConfirmPlan()}>
              确认计划
            </EcomButtonPrimary>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#e5e5ea]">
        <table className="min-w-[880px] w-full text-left text-xs">
          <thead className="bg-[#f5f5f7] text-[#86868b]">
            <tr>
              <th className="w-10 px-3 py-2 font-medium">#</th>
              <th className="w-12 px-3 py-2 font-medium">分类</th>
              <th className="min-w-[88px] px-3 py-2 font-medium">标题</th>
              <th className="min-w-[200px] px-3 py-2 font-medium">姿势</th>
              <th className="min-w-[160px] px-3 py-2 font-medium">场景</th>
              <th className="min-w-[120px] px-3 py-2 font-medium">道具</th>
              <th className="w-12 px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {plan.items.map((item) => (
              <tr key={item.index} className="border-t border-[#e5e5ea]">
                <td className="px-3 py-3 align-top text-[#1d1d1f]">{item.index}</td>
                <td className="px-3 py-3 align-top text-[#424245]">{item.category ?? "—"}</td>
                <td className="px-3 py-3 align-top text-[#424245]">{item.title ?? "—"}</td>
                {editIndex === item.index ? (
                  <>
                    <td className="px-3 py-3 align-top" colSpan={3}>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="block space-y-1">
                          <span className="text-[10px] font-medium text-[#86868b]">姿势</span>
                          <textarea
                            className="min-h-[88px] w-full rounded-lg border border-[#d2d2d7] p-2 text-xs leading-relaxed"
                            value={draft.poseDescription}
                            disabled={busy}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, poseDescription: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-medium text-[#86868b]">场景</span>
                          <textarea
                            className="min-h-[88px] w-full rounded-lg border border-[#d2d2d7] p-2 text-xs leading-relaxed"
                            value={draft.sceneText}
                            disabled={busy}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, sceneText: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[10px] text-[#0071e3]"
                            disabled={busy}
                            onClick={() => void openPicker("scene", item.index, false)}
                          >
                            <BookOpen className="h-3 w-3" />
                            从词库选择
                          </button>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-medium text-[#86868b]">道具</span>
                          <textarea
                            className="min-h-[88px] w-full rounded-lg border border-[#d2d2d7] p-2 text-xs leading-relaxed"
                            value={draft.propText}
                            disabled={busy}
                            placeholder="留空表示无道具"
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, propText: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[10px] text-[#0071e3]"
                            disabled={busy}
                            onClick={() => void openPicker("prop", item.index, false)}
                          >
                            <BookOpen className="h-3 w-3" />
                            从词库选择
                          </button>
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="text-[11px] text-[#0071e3]"
                          disabled={busy || !draft.poseDescription.trim()}
                          onClick={async () => {
                            await onPatchItem(item.index, draft);
                            setEditIndex(null);
                          }}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className="text-[11px] text-[#86868b]"
                          onClick={() => setEditIndex(null)}
                        >
                          取消
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-3 align-top">
                      <p className="line-clamp-4 whitespace-pre-wrap text-[#424245]">
                        {displayPoseDescription(item)}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="line-clamp-4 whitespace-pre-wrap text-[#424245]">
                        {displaySceneText(item)}
                      </p>
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#0071e3]"
                        disabled={busy}
                        onClick={() => void openPicker("scene", item.index, false)}
                      >
                        <BookOpen className="h-3 w-3" />
                        词库
                      </button>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="line-clamp-4 whitespace-pre-wrap text-[#424245]">
                        {displayPropText(item)}
                      </p>
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#0071e3]"
                        disabled={busy}
                        onClick={() => void openPicker("prop", item.index, false)}
                      >
                        <BookOpen className="h-3 w-3" />
                        词库
                      </button>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        className="text-[#86868b] hover:text-[#1d1d1f]"
                        disabled={busy}
                        onClick={() => {
                          setEditIndex(item.index);
                          setDraft(toDraft(item));
                        }}
                        aria-label="编辑姿势、场景与道具"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EcomCatalogPickerDialog
        open={pickerOpen}
        title={
          catalogLoading
            ? "加载词库…"
            : pickerKind === "scene"
              ? applyToAll
                ? "选择场景 · 应用到全部"
                : "选择场景"
              : applyToAll
                ? "选择道具 · 应用到全部"
                : "选择道具"
        }
        entries={catalogLoading ? [] : pickerEntries}
        onOpenChange={setPickerOpen}
        onPick={handlePickerPick}
      />
    </section>
  );
}
