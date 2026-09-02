"use client";

import { useCallback, useRef, useState } from "react";
import { Clapperboard, Loader2, Upload } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { showCanvasSuccessToast } from "@/components/canvas/canvas-credits-toast-host";
import {
  Pro2DockHeader,
  Pro2InputDockShell,
} from "@/components/canvas/pro2/pro2-input-dock-shell";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { applyProductionScriptDirectToHub } from "@/lib/canvas/pro2-production-script-apply";
import {
  analyzeCanvasFilmPull,
  attachCanvasFilmPullVideoFromUrl,
  createCanvasFilmPullProject,
  exportCanvasFilmPullPro2,
  uploadCanvasFilmPullVideo,
} from "@/lib/canvas/film-pull-api";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: string;
  filmPullProjectId?: string;
  filmPullScriptHubId?: string;
  videoUrl?: string;
  placement: LibtvDockFlowPlacement;
  hidden?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
};

function resolveScriptHubId(
  nodeId: string,
  explicitHubId: string | undefined,
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
): string | null {
  if (explicitHubId?.trim()) return explicitHubId.trim();
  const outEdge = edges.find(
    (e) => e.source === nodeId && nodes.find((n) => n.id === e.target)?.type === "story-pro2-script-hub",
  );
  if (outEdge) return outEdge.target;
  const inEdge = edges.find(
    (e) => e.target === nodeId && nodes.find((n) => n.id === e.source)?.type === "story-pro2-script-hub",
  );
  if (inEdge) return inEdge.source;
  const self = nodes.find((n) => n.id === nodeId);
  const parentId = self?.parentId;
  if (parentId) {
    const sibling = nodes.find(
      (n) => n.parentId === parentId && n.type === "story-pro2-script-hub",
    );
    if (sibling) return sibling.id;
  }
  return null;
}

export function FilmPullVideoDock({
  nodeId,
  filmPullProjectId,
  filmPullScriptHubId,
  videoUrl,
  placement,
  hidden,
  onPatch,
}: Props) {
  const base = useBookMallBaseUrl();
  const canvasProjectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { alert } = useDialogs();
  const [busy, setBusy] = useState(false);
  const [shotCount, setShotCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const projectIdRef = useRef(filmPullProjectId);

  const ensureProject = useCallback(async (): Promise<string> => {
    if (!base) throw new Error("画布未就绪");
    if (projectIdRef.current) return projectIdRef.current;
    const project = await createCanvasFilmPullProject(base, {
      title: "Canvas 视频拉片",
      canvasProjectId: canvasProjectId ?? undefined,
    });
    projectIdRef.current = project.id;
    onPatch({ filmPullProjectId: project.id });
    return project.id;
  }, [base, canvasProjectId, onPatch]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        await alert({
          title: "操作失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setBusy(false);
      }
    },
    [alert],
  );

  const onUseNodeVideo = useCallback(() => {
    if (!videoUrl?.trim()) {
      void alert({
        title: "暂无视频",
        message: "请先在节点内上传或生成源视频（≤60s）。",
        variant: "warning",
      });
      return;
    }
    void run(async () => {
      const pid = await ensureProject();
      await attachCanvasFilmPullVideoFromUrl(base!, pid, videoUrl.trim());
      showCanvasSuccessToast("已关联节点视频");
    });
  }, [videoUrl, run, ensureProject, base, alert]);

  const onUpload = useCallback(
    (file: File) => {
      void run(async () => {
        const pid = await ensureProject();
        await uploadCanvasFilmPullVideo(base!, pid, file);
        showCanvasSuccessToast("视频已上传");
      });
    },
    [run, ensureProject, base],
  );

  const onAnalyze = useCallback(() => {
    void run(async () => {
      const pid = await ensureProject();
      const project = await analyzeCanvasFilmPull(base!, pid);
      const count = project.analyzeResult?.structured?.shots?.length ?? 0;
      setShotCount(count);
      if (project.analyzeResult?.parseError) {
        throw new Error(project.analyzeResult.parseError);
      }
      if (count < 1) throw new Error("拉片未产出分镜，请重试");
      showCanvasSuccessToast(`拉片完成 · 共 ${count} 镜`);
    });
  }, [run, ensureProject, base]);

  const onImportHub = useCallback(() => {
    void run(async () => {
      const pid = await ensureProject();
      const hubId = resolveScriptHubId(nodeId, filmPullScriptHubId, nodes, edges);
      if (!hubId) {
        throw new Error("未找到 Script Hub 节点，请使用「视频拉片」预设或手动连接制作包节点");
      }
      const hubNode = nodes.find((n) => n.id === hubId);
      if (!hubNode || hubNode.type !== "story-pro2-script-hub") {
        throw new Error("Script Hub 节点无效");
      }
      const { productionScript } = await exportCanvasFilmPullPro2(base!, pid, {
        title: "视频拉片导入",
      });
      const hubPatch = applyProductionScriptDirectToHub(
        hubNode.data as StoryProScriptHubNodeData,
        productionScript,
        hubId,
      );
      updateNodeData(hubId, hubPatch);
      onPatch({ filmPullScriptHubId: hubId });
      showCanvasSuccessToast("已导入制作包 · 分镜已写入 Script Hub");
    });
  }, [
    run,
    ensureProject,
    nodeId,
    filmPullScriptHubId,
    nodes,
    edges,
    base,
    updateNodeData,
    onPatch,
  ]);

  return (
    <>
      <Pro2InputDockShell
        flowAnchor={placement}
        hidden={hidden}
        anchorNodeId={nodeId}
        header={
          <Pro2DockHeader
            compact
            actionRow={
              <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-white/90">
                <Clapperboard className="h-3.5 w-3.5" strokeWidth={1.75} />
                专业拉片 · ≤60s
              </span>
            }
          />
        }
        footer={
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <button
              type="button"
              disabled={busy}
              className={cn(
                "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/90",
                "hover:bg-white/10 disabled:opacity-50",
              )}
              onClick={onUseNodeVideo}
            >
              使用节点视频
            </button>
            <button
              type="button"
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/90",
                "hover:bg-white/10 disabled:opacity-50",
              )}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              上传视频
            </button>
            <button
              type="button"
              disabled={busy}
              className={cn(
                "rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white",
                "hover:bg-violet-500 disabled:opacity-50",
              )}
              onClick={onAnalyze}
            >
              {busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
              开始拉片
            </button>
            <button
              type="button"
              disabled={busy || (shotCount !== null && shotCount < 1)}
              className={cn(
                "ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white",
                "hover:bg-emerald-500 disabled:opacity-50",
              )}
              onClick={onImportHub}
            >
              导入制作包
            </button>
          </div>
        }
      >
        <p className="px-3 py-2 text-xs leading-relaxed text-white/60">
          上传 ≤60s 参考视频 → 工业化逐镜拉片 → 一键写入右侧 Script Hub 分镜表。
          {shotCount != null ? ` 当前 ${shotCount} 镜。` : null}
          {filmPullProjectId ? ` 项目 ${filmPullProjectId.slice(0, 8)}…` : null}
        </p>
      </Pro2InputDockShell>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
