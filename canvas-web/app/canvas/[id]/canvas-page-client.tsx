"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { MyTemplatesPanel } from "@/components/canvas/my-templates-panel";
import { NodePalette } from "@/components/canvas/node-palette";
import { CanvasToolbar } from "@/components/canvas/toolbar";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  useCanvasInflightTaskCount,
  useCanvasRunner,
} from "@/lib/canvas/run-queue";
import { stripRuntimeForTemplate } from "@/lib/canvas/sanitize";
import { buildTextNodeDataFromPreset } from "@/lib/canvas/text-templates";
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
  type CanvasProjectDetail,
} from "@/lib/canvas-api";
import { defaultCanvasProjectName } from "@/lib/canvas/default-project-name";
import { pickProjectThumbnailUrl } from "@/lib/canvas/project-thumbnail";

const AUTOSAVE_DEBOUNCE_MS = 1500;

function Inner({ projectId }: { projectId: string }) {
  const base = useBookMallBaseUrl();
  const dialogs = useDialogs();
  const hydrate = useCanvasStore((s) => s.hydrate);
  const toGraph = useCanvasStore((s) => s.toGraph);
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  const [project, setProject] = useState<CanvasProjectDetail | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [myTemplatesOpen, setMyTemplatesOpen] = useState(false);
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);

  const { enqueueNode } = useCanvasRunner();
  const inflightTaskCount = useCanvasInflightTaskCount();

  // Load project
  useEffect(() => {
    if (!base) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const p = await getCanvasProject(base, projectId);
        if (cancelled) return;
        setProject(p);
        setNameDraft(p.name);
        hydrate(projectId, p.canvas as never);
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
    if (!project || !base) return;
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(async () => {
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
  }, [nodes, edges, project, base, projectId, toGraph]);

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
          : undefined;
      addNode(type, center, initialData);
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

  const runAll = useCallback(() => {
    let order: string[];
    try {
      order = topoSort(nodes, edges);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "拓扑失败");
      return;
    }
    for (const id of order) {
      const n = nodes.find((x) => x.id === id);
      if (n && isRunnableNodeType(n.type as CanvasNodeType)) {
        enqueueNode(id);
      }
    }
  }, [nodes, edges, enqueueNode]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--canvas-bg)] text-[var(--canvas-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        加载画布…
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[var(--canvas-bg)] text-sm text-red-200">
        <p>无法加载画布：{loadError ?? "未知错误"}</p>
        <a href="/projects" className="underline">
          返回我的画布
        </a>
      </div>
    );
  }

  return (
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
        onSaveTemplate={() => void onSaveTemplate()}
        running={inflightTaskCount > 0}
        inflightTaskCount={inflightTaskCount}
      />
      <MyTemplatesPanel
        open={myTemplatesOpen}
        onClose={() => setMyTemplatesOpen(false)}
        refreshKey={templatesRefreshKey}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <FlowCanvas onUndo={undo} onRedo={redo} />
        {/* 画布内顶部居中节点面板（位于工具栏下方，勿用 fixed 顶到视口顶端） */}
        <NodePalette onAdd={onAddViaPalette} />
      </div>
    </div>
  );
}

export function CanvasPageClient({ projectId }: { projectId: string }) {
  return (
    <RequireAuth>
      <Inner projectId={projectId} />
    </RequireAuth>
  );
}
