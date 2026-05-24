"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutTemplate, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { MyTemplatesPanel } from "@/components/canvas/my-templates-panel";
import { MyCharactersPanel } from "@/components/canvas/my-characters-panel";
import { NodePalette } from "@/components/canvas/node-palette";
import { CanvasToolbar } from "@/components/canvas/toolbar";
import { useCanvasStore } from "@/lib/canvas/store";
import { busEnqueueNodesSequential } from "@/lib/canvas/canvas-run-bus";
import {
  CanvasRunnerHost,
  useCanvasInflightTaskCount,
} from "@/lib/canvas/run-queue";
import { stripRuntimeForTemplate } from "@/lib/canvas/sanitize";
import { buildTextNodeDataFromPreset } from "@/lib/canvas/text-templates";
import { buildImageEngineDataFromPreset } from "@/lib/canvas/image-engine-presets";
import { topoSort } from "@/lib/canvas/topo";
import type {
  CanvasContentNodeType,
  CanvasNodeType,
} from "@/lib/canvas/types";
import { isRunnableNodeType } from "@/lib/canvas/types";
import {
  getCanvasProject,
  patchCanvasProject,
  saveCanvasTemplate,
  type CanvasCharacterRecord,
  type CanvasProjectDetail,
} from "@/lib/canvas-api";
import { defaultCanvasProjectName } from "@/lib/canvas/default-project-name";
import { hasStoryComicPipeline } from "@/lib/canvas/story-comic-layout";
import { pickProjectThumbnailUrl } from "@/lib/canvas/project-thumbnail";
import { getBuiltinCanvasTemplate } from "@/lib/canvas/templates";

const AUTOSAVE_DEBOUNCE_MS = 1500;
const STORY_COMIC_TEMPLATE_ID = "builtin/story-comic-pipeline";

function Inner({ projectId }: { projectId: string }) {
  const base = useBookMallBaseUrl();
  const dialogs = useDialogs();
  const hydrate = useCanvasStore((s) => s.hydrate);
  const toGraph = useCanvasStore((s) => s.toGraph);
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const reflowStoryComicLayout = useCanvasStore(
    (s) => s.reflowStoryComicLayout,
  );
  const isStoryComicCanvas = hasStoryComicPipeline(nodes);

  const [project, setProject] = useState<CanvasProjectDetail | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [myTemplatesOpen, setMyTemplatesOpen] = useState(false);
  const [myCharactersOpen, setMyCharactersOpen] = useState(false);
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);

  /** 加载完成时的节点数；用于阻止误把「有内容的画布」自动保存成空。 */
  const loadedNodeCountRef = useRef(0);
  const canvasReadyRef = useRef(false);

  const inflightTaskCount = useCanvasInflightTaskCount();

  // Load project
  useEffect(() => {
    if (!base) return;
    let cancelled = false;
    canvasReadyRef.current = false;
    setProject(null);
    setLoading(true);
    void (async () => {
      try {
        const p = await getCanvasProject(base, projectId);
        if (cancelled) return;
        const rawCanvas = p.canvas as { nodes?: unknown[] } | null;
        loadedNodeCountRef.current = Array.isArray(rawCanvas?.nodes)
          ? rawCanvas.nodes.length
          : 0;
        useCanvasStore.temporal.getState().pause();
        hydrate(projectId, p.canvas as never);
        useCanvasStore.temporal.getState().clear();
        useCanvasStore.temporal.getState().resume();
        setProject(p);
        setNameDraft(p.name);
        canvasReadyRef.current = true;
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, projectId, hydrate]);

  // Autosave on changes (debounced)
  const autosaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!project || !base || loading || !canvasReadyRef.current) return;
    if (
      nodes.length === 0 &&
      loadedNodeCountRef.current > 0 &&
      edges.length === 0
    ) {
      setSaveError("检测到画布被清空，已阻止自动保存。请刷新或点「恢复漫剧模板」。");
      return;
    }
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        const graph = toGraph();
        if (
          graph.nodes.length === 0 &&
          loadedNodeCountRef.current > 0
        ) {
          setSaveError("检测到画布被清空，已阻止自动保存。");
          return;
        }
        const thumb = pickProjectThumbnailUrl(graph);
        const patch: {
          canvas: typeof graph;
          thumbnailUrl?: string;
        } = { canvas: graph };
        if (thumb && thumb !== project.thumbnailUrl) {
          patch.thumbnailUrl = thumb;
        }
        await patchCanvasProject(base, projectId, patch);
        loadedNodeCountRef.current = graph.nodes.length;
        if (patch.thumbnailUrl) {
          setProject((p) =>
            p ? { ...p, thumbnailUrl: patch.thumbnailUrl! } : p,
          );
        }
        setLastSavedAt(new Date());
        setSaveError(null);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "保存失败");
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [nodes, edges, project, base, projectId, toGraph, loading]);

  const undo = useCallback(() => {
    const tStore = useCanvasStore.temporal.getState();
    tStore.undo();
  }, []);

  const redo = useCallback(() => {
    const tStore = useCanvasStore.temporal.getState();
    tStore.redo();
  }, []);

  const manualSave = useCallback(async () => {
    if (!base || !project) return;
    setSaving(true);
    try {
      const graph = toGraph();
      const thumb = pickProjectThumbnailUrl(graph);
      const patch: {
        canvas: typeof graph;
        thumbnailUrl?: string;
      } = { canvas: graph };
      if (thumb && thumb !== project.thumbnailUrl) {
        patch.thumbnailUrl = thumb;
      }
      await patchCanvasProject(base, projectId, patch);
      loadedNodeCountRef.current = graph.nodes.length;
      if (patch.thumbnailUrl) {
        setProject((p) =>
          p ? { ...p, thumbnailUrl: patch.thumbnailUrl! } : p,
        );
      }
      setLastSavedAt(new Date());
      setSaveError(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [base, project, projectId, toGraph]);

  const commitProjectName = useCallback(async () => {
    if (!base || !project) return;
    const next = nameDraft.trim() || defaultCanvasProjectName();
    if (next === project.name) {
      setNameDraft(project.name);
      return;
    }
    try {
      await patchCanvasProject(base, projectId, { name: next });
      setProject((p) => (p ? { ...p, name: next } : p));
      setNameDraft(next);
      setSaveError(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "名称保存失败");
      setNameDraft(project.name);
    }
  }, [base, nameDraft, project, projectId]);

  const onAddViaPalette = useCallback(
    (type: CanvasContentNodeType, presetId?: string) => {
      const center = { x: 240 + Math.random() * 60, y: 160 + Math.random() * 60 };
      const initialData =
        type === "text" && presetId
          ? buildTextNodeDataFromPreset(presetId)
          : type === "image-engine" && presetId
            ? buildImageEngineDataFromPreset(presetId)
            : undefined;
      addNode(type, center, initialData);
    },
    [addNode],
  );

  const onInsertCharacter = useCallback(
    (character: CanvasCharacterRecord) => {
      const center = { x: 240 + Math.random() * 80, y: 160 + Math.random() * 80 };
      addNode("image", center, {
        ossUrl: character.imageUrl,
        label: character.name,
      });
    },
    [addNode],
  );

  const onSaveTemplate = useCallback(async () => {
    if (!base) return;
    const tplName = await dialogs.prompt({
      title: "保存为我的模板",
      message: "模板仅你可见，可在「新建画布」时复用。",
      label: "模板名",
      defaultValue: `${project?.name ?? "未命名"} 模板`,
      placeholder: "请输入模板名",
      confirmLabel: "保存",
      validate: (v) => (v.trim() ? null : "模板名不能为空"),
    });
    if (!tplName) return;
    try {
      const cleaned = stripRuntimeForTemplate(toGraph());
      await saveCanvasTemplate(base, {
        name: tplName.trim(),
        canvas: cleaned,
        category: "user",
      });
      setSaveError(null);
      setTemplatesRefreshKey((k) => k + 1);
      await dialogs.alert({
        title: "已保存",
        message: "模板已保存，可在工具栏「我的模板」中查看。",
        variant: "success",
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存模板失败");
    }
  }, [base, project?.name, toGraph, dialogs]);

  const restoreStoryComicTemplate = useCallback(async () => {
    const tpl = getBuiltinCanvasTemplate(STORY_COMIC_TEMPLATE_ID);
    if (!tpl) return;
    const ok = await dialogs.confirm({
      title: "载入漫剧全链路模板？",
      message: "将用官方向导模板（漫剧启动 + 导出）覆盖当前画布结构。",
      confirmLabel: "载入",
    });
    if (!ok) return;
    useCanvasStore.temporal.getState().pause();
    hydrate(projectId, tpl);
    useCanvasStore.temporal.getState().clear();
    useCanvasStore.temporal.getState().resume();
    loadedNodeCountRef.current = tpl.nodes.length;
    setSaveError(null);
    reflowStoryComicLayout();
    await manualSave();
  }, [dialogs, hydrate, manualSave, projectId, reflowStoryComicLayout]);

  const runAll = useCallback(() => {
    let order: string[];
    try {
      order = topoSort(nodes, edges);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "拓扑失败");
      return;
    }
    const runnableIds = order.filter((id) => {
      const n = nodes.find((x) => x.id === id);
      return n && isRunnableNodeType(n.type as CanvasNodeType);
    });
    if (!runnableIds.length) return;
    busEnqueueNodesSequential(runnableIds);
  }, [nodes, edges]);

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="flex h-screen items-center justify-center bg-[var(--canvas-bg)] text-[var(--canvas-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        加载画布…
      </div>
    );
  } else if (loadError || !project) {
    body = (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[var(--canvas-bg)] text-sm text-red-200">
        <p>无法加载画布：{loadError ?? "未知错误"}</p>
        <a href="/projects" className="underline">
          返回我的画布
        </a>
      </div>
    );
  } else {
    body = (
      <div className="flex h-screen flex-col bg-[var(--canvas-bg)]">
        <CanvasToolbar
        projectName={nameDraft}
        onProjectNameChange={setNameDraft}
        onProjectNameCommit={() => void commitProjectName()}
        saving={saving}
        saveError={saveError}
        lastSavedAt={lastSavedAt}
        onSave={() => void manualSave()}
        onUndo={undo}
        onRedo={redo}
        onRunAll={runAll}
        onOpenMyTemplates={() => setMyTemplatesOpen(true)}
        onOpenMyCharacters={() => setMyCharactersOpen(true)}
        onReflowStoryLayout={
          isStoryComicCanvas ? () => reflowStoryComicLayout() : undefined
        }
        onSaveTemplate={() => void onSaveTemplate()}
        running={inflightTaskCount > 0}
        inflightTaskCount={inflightTaskCount}
      />
      <MyTemplatesPanel
        open={myTemplatesOpen}
        onClose={() => setMyTemplatesOpen(false)}
        refreshKey={templatesRefreshKey}
      />
      <MyCharactersPanel
        open={myCharactersOpen}
        onClose={() => setMyCharactersOpen(false)}
        onInsertCharacter={onInsertCharacter}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <FlowCanvas onUndo={undo} onRedo={redo} />
        {isStoryComicCanvas && nodes.length > 0 ? (
          <button
            type="button"
            className="absolute bottom-6 right-6 z-20 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-[var(--canvas-surface)]/95 px-4 py-2 text-xs font-medium text-emerald-100 shadow-lg hover:border-emerald-400/60 hover:bg-emerald-500/15"
            title="按漫剧工作流重新排列所有节点"
            onClick={() => reflowStoryComicLayout()}
          >
            <LayoutTemplate className="size-3.5" />
            重排
          </button>
        ) : null}
        {nodes.length === 0 && !loading && loadedNodeCountRef.current > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-md rounded-xl border border-white/10 bg-[var(--canvas-surface)]/95 px-6 py-5 text-center shadow-xl">
              <p className="text-sm font-medium text-white">节点数据丢失</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--canvas-muted)]">
                云端记录里这个画布已被保存为空。若还有其他副本，请到
                <Link href="/projects" className="mx-1 underline">
                  我的画布
                </Link>
                打开；否则可重新载入模板。
              </p>
              <button
                type="button"
                className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500"
                onClick={() => void restoreStoryComicTemplate()}
              >
                恢复「漫剧全链路」模板
              </button>
            </div>
          </div>
        ) : null}
        {nodes.length === 0 && !loading && loadedNodeCountRef.current === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-sm rounded-xl border border-white/10 bg-black/50 px-5 py-4 text-center">
              <p className="text-xs text-[var(--canvas-muted)]">
                空白画布 · 从上方工具栏拖入节点
              </p>
              <button
                type="button"
                className="mt-3 rounded-md border border-emerald-400/30 px-3 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-500/10"
                onClick={() => void restoreStoryComicTemplate()}
              >
                载入「漫剧全链路」模板
              </button>
            </div>
          </div>
        ) : null}
        {/* 画布内顶部居中节点面板（位于工具栏下方，勿用 fixed 顶到视口顶端） */}
        <NodePalette onAdd={onAddViaPalette} />
      </div>
    </div>
    );
  }

  return (
    <>
      <CanvasRunnerHost projectId={projectId} />
      {body}
    </>
  );
}

export function CanvasPageClient({ projectId }: { projectId: string }) {
  return (
    <RequireAuth>
      <Inner projectId={projectId} />
    </RequireAuth>
  );
}
