"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { ModelShotPlan, ModelShotPoseItem } from "@/lib/model-shot-types";

type PoseItemPatch = {
  poseDescription: string;
  sceneText: string;
  propText: string;
};

type Props = {
  plan: ModelShotPlan;
  onPatchItem: (index: number, patch: PoseItemPatch) => Promise<void>;
  onConfirmPlan: () => Promise<void>;
  onGeneratePoses: () => Promise<void>;
  busy?: boolean;
  canGeneratePoses?: boolean;
  confirmed?: boolean;
};

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
  };
}

export function ModelShotPosePlanTable({
  plan,
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
          {confirmed ? (
            <p className="mt-1 text-[11px] text-[#86868b]">
              修改并保存后，下方生成模特图将按最新脚本执行。
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
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
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="line-clamp-4 whitespace-pre-wrap text-[#424245]">
                        {displayPropText(item)}
                      </p>
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
    </section>
  );
}
