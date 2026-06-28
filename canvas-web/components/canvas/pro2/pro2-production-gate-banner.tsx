"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Link2, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { resolvePro2ProductionGate } from "@/lib/canvas/pro2-production-gate";
import { acquireProjectAssetLease } from "@/lib/canvas-api";
import { buildCrewBulletinGraphAnchorFromAsset } from "@/lib/canvas/crew-bulletin-graph-anchor";
import { listPickableScriptPackages } from "@/lib/canvas/list-pickable-script-packages";
import type { StoryProStarterNodeData } from "@/lib/canvas/story-pro-workspace-types";

/** 生产画布 · 关联剧本提示条（非强制阻断） */
export function Pro2ProductionGateBanner() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const patchGraphMeta = useCanvasStore((s) => s.patchGraphMeta);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<
    Array<{ id: string; displayName: string; payload: Record<string, unknown> }>
  >([]);

  const gate = useMemo(
    () => resolvePro2ProductionGate(nodes, graphMeta ?? undefined),
    [nodes, graphMeta],
  );

  const starter = useMemo(
    () => nodes.find((n) => n.type === "story-pro2-starter"),
    [nodes],
  );

  const linkedAssetId =
    graphMeta?.linkedScriptPackageAssetId ??
    graphMeta?.crewBulletinAnchor?.linkedScriptPackageAssetId ??
    ((starter?.data ?? {}) as StoryProStarterNodeData).workspaceIds
      ?.linkedScriptPackageAssetId;

  const openPicker = useCallback(async () => {
    if (!base?.trim()) {
      await alert({
        title: "无法加载",
        message: "未配置主站地址，无法列出剧本包资产。",
        variant: "warning",
      });
      return;
    }
    setPickerOpen(true);
    setLoading(true);
    try {
      const list = await listPickableScriptPackages(base);
      setPackages(list);
    } catch (e) {
      await alert({
        title: "加载失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
      setPickerOpen(false);
    } finally {
      setLoading(false);
    }
  }, [alert, base]);

  const linkAsset = useCallback(
    async (asset: {
      id: string;
      displayName: string;
      payload: Record<string, unknown>;
    }) => {
      try {
        if (base?.trim()) {
          await acquireProjectAssetLease(base, asset.id);
        }
      } catch {
        /* 认领失败不阻断关联 */
      }

      const anchor = buildCrewBulletinGraphAnchorFromAsset(asset);
      if (starter) {
        updateNodeData(starter.id, {
          workspaceIds: { linkedScriptPackageAssetId: asset.id },
          linkedScriptPackageTitle: asset.displayName,
          linkedScriptPackageMarkdown: anchor.linkedScriptPackageMarkdown,
          crewBulletin: anchor.crewBulletin,
          scriptStudioTotalEpisodes: anchor.scriptStudioTotalEpisodes,
          scriptStudioCharacterRows: anchor.scriptStudioCharacterRows,
          sceneRows: anchor.sceneRows,
          scriptStudioPropRows: anchor.scriptStudioPropRows,
          scriptStudioFrameRows: anchor.scriptStudioFrameRows,
          scriptStudioMoodRows: anchor.scriptStudioMoodRows,
          scriptStudioAudioRows: anchor.scriptStudioAudioRows,
        });
      } else {
        patchGraphMeta((meta) => ({
          ...meta,
          edition: meta?.edition ?? "pro2",
          linkedScriptPackageAssetId: asset.id,
          crewBulletinAnchor: anchor,
        }));
      }
      setPickerOpen(false);
    },
    [base, starter, updateNodeData, patchGraphMeta],
  );

  if (gate.linked) return null;
  if (!gate.requireLinkedScript && !gate.optionalLinkPrompt) return null;

  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-3 z-[56] flex -translate-x-1/2 justify-center px-3">
        <div className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-950/90 px-3 py-2 text-[11px] text-amber-100/95 shadow-lg">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="flex-1">{gate.message}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 px-2 py-0.5 text-[10px] hover:bg-amber-500/15"
            onClick={() => void openPicker()}
          >
            <Link2 className="size-3" />
            关联剧本包
          </button>
        </div>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[var(--canvas-surface)] p-4 text-white shadow-xl">
            <p className="mb-3 text-sm font-medium">选择已定稿剧本包</p>
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-white/55">
                <Loader2 className="size-4 animate-spin" />
                加载中…
              </div>
            ) : packages.length === 0 ? (
              <p className="py-4 text-sm text-white/55">
                暂无已发布剧本。请先在任意 2.0 画布的脚本生成器中发布剧本。
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {packages.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`w-full rounded-lg border px-3 py-2 text-left text-[12px] transition hover:bg-white/5 ${
                        linkedAssetId === p.id
                          ? "border-cyan-400/40 bg-cyan-500/10"
                          : "border-white/10"
                      }`}
                      onClick={() => void linkAsset(p)}
                    >
                      {p.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/5"
                onClick={() => setPickerOpen(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
