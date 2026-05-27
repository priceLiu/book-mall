"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  Eye,
  FileUp,
  Lock,
  PenLine,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { uploadCanvasFile } from "@/lib/canvas-api";
import { useCanvasStore } from "@/lib/canvas/store";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import {
  STORY_PRO_THEME_SYSTEM_PROMPT_TEMPLATES,
} from "@/lib/canvas/story-pro-prompts";
import { storyThemePromptDisplayMd } from "@/lib/canvas/story-theme-prompt-display";
import {
  STORY_PRO_CONTROL_NODE_HEIGHT,
  STORY_PRO_CONTROL_NODE_WIDTH,
  PRO_HINT_LABEL_CLASS,
  PRO_NODE_ACTION_BTN_CLASS,
  PRO_TEMPLATE_CHIP_CLASS,
} from "@/lib/canvas/story-pro-node-chrome";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { StoryThemePromptPreviewPane } from "../story-theme-prompt-preview-pane";
import { StoryThemePromptModal } from "../story-theme-prompt-modal";
import { StoryProScriptUploadPreviewModal } from "../story-pro-script-upload-preview-modal";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { runStoryHubSectionsSequential } from "@/lib/canvas/batch-run-nodes";
import {
  findStoryProScriptHubForStarter,
  spawnStoryProScriptHub,
  STORY_PRO_HUB_SECTION_ORDER,
  findStoryProWorkspaceForStarter,
} from "@/lib/canvas/spawn-story-pro-workspace";
import { reflowStoryProWorkspace } from "@/lib/canvas/story-pro-workspace-layout";
import {
  hubAggregateStatus,
  hubSectionRuntime,
} from "@/lib/canvas/story-hub-runtime";
import {
  syncStoryProHubFromStarter,
  storyProStarterHasScriptSource,
} from "@/lib/canvas/story-pro-starter-sync";
import {
  parseStoryProUploadScriptFile,
  STORY_PRO_UPLOAD_SCRIPT_ACCEPT,
  STORY_PRO_UPLOADED_SCRIPT_REF_ID,
  fetchUploadedScriptFromOss,
  storyProUploadedScriptMentionLabel,
} from "@/lib/canvas/story-pro-upload-script";
import { resolveStoryProStarterScriptInput } from "@/lib/canvas/story-pro-starter-text";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterMode,
  StoryProStarterNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import { ProNodeShell } from "../pro-node-shell";
import { NodeStatusBadge } from "../node-shell";
import { StoryProGuidePanel } from "../story-pro-guide-panel";
import { EnginePicker } from "../engine-picker";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";

const STAGE_LABELS: Record<string, string> = {
  idle: "上传剧本 → 解析",
  llm_done: "剧本已解析 · 打开「故事剧本」审阅",
  script_finalized: "故事已定稿 · 打开「风格定义」",
  style_finalized: "风格已定稿 · 工作流已输出",
  finalized: "已定稿 · 工作流已输出",
};

export function StoryProStarterNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const setNodes = useCanvasStore((s) => s.setNodes);

  const d = data as unknown as StoryProStarterNodeData;
  const starterMode: StoryProStarterMode = d.starterMode ?? "upload";
  const { providers } = useUserProviders();
  const stage = d.pipelineStage ?? "idle";
  const isFinalized = stage === "finalized" || stage === "style_finalized";
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [scriptPreviewOpen, setScriptPreviewOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [scriptLoadBusy, setScriptLoadBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const systemPrompt = d.systemPrompt ?? "";
  const promptPreviewMd = useMemo(
    () => storyThemePromptDisplayMd(systemPrompt),
    [systemPrompt],
  );

  const upstreamScript = useMemo(
    () => resolveStoryProStarterScriptInput(nodes, edges, id),
    [nodes, edges, id],
  );

  const hasUploadedScript = Boolean(
    d.uploadedScriptMd?.trim() || d.uploadedScriptOssUrl?.trim(),
  );
  const hasScriptSource = storyProStarterHasScriptSource(d, upstreamScript);

  const scriptMentionables = useMemo(() => {
    if (!hasUploadedScript) return [];
    return [
      {
        id: STORY_PRO_UPLOADED_SCRIPT_REF_ID,
        label: storyProUploadedScriptMentionLabel(d.uploadedScriptMeta),
        kind: "text" as const,
      },
    ];
  }, [hasUploadedScript, d.uploadedScriptMeta]);

  const scriptHub = useMemo(
    () => findStoryProScriptHubForStarter(nodes, edges, id, d.workspaceIds),
    [nodes, edges, id, d.workspaceIds],
  );

  const hubStatus = useMemo(() => {
    if (!scriptHub) return { status: "idle" as const, failMessage: null };
    const hub = nodes.find((n) => n.id === scriptHub.scriptHubId);
    if (!hub) return { status: "idle" as const, failMessage: null };
    const agg = hubAggregateStatus(hub);
    if (agg === "running") {
      return { status: "running" as const, failMessage: null };
    }
    if (agg === "error") {
      const runtimes = ["outline", "character", "storyboard"] as const;
      const failed = runtimes.find(
        (s) => hubSectionRuntime(hub, s)?.status === "error",
      );
      return {
        status: "error" as const,
        failMessage:
          (failed
            ? (hubSectionRuntime(hub, failed) as { failMessage?: string })
                ?.failMessage
            : undefined) ?? "剧本解析失败",
      };
    }
    return { status: "idle" as const, failMessage: null };
  }, [nodes, scriptHub]);

  const canRun = Boolean(
    !isFinalized &&
      hasScriptSource &&
      systemPrompt.trim() &&
      d.providerId &&
      d.modelKey,
  );
  const isGenerating = hubStatus.status === "running";
  const promptEditLocked = isGenerating || isFinalized;
  const fieldsLocked = isGenerating || isFinalized;

  const hasScriptDraft = useMemo(() => {
    if (!scriptHub) return false;
    const hub = nodes.find((n) => n.id === scriptHub.scriptHubId);
    if (!hub) return false;
    const hd = hub.data as StoryProScriptHubNodeData;
    if ((hd.outlineMd ?? "").trim()) return true;
    return hubAggregateStatus(hub) === "done";
  }, [nodes, scriptHub]);

  const reflowProLayout = useCallback(() => {
    const state = useCanvasStore.getState();
    setNodes(() => reflowStoryProWorkspace(state.nodes, state.edges));
  }, [setNodes]);

  useEffect(() => {
    if (!scriptHub) return;
    const ws = findStoryProWorkspaceForStarter(
      nodes,
      edges,
      id,
      d.workspaceIds,
    );
    if (!ws) return;
    const patch: Partial<StoryProStarterNodeData> = {};
    if (JSON.stringify(d.workspaceIds ?? {}) !== JSON.stringify(ws)) {
      patch.workspaceIds = ws;
    }
    const hub = nodes.find((n) => n.id === ws.scriptHubId);
    const hubFinalized = Boolean(
      (hub?.data as StoryProScriptHubNodeData)?.scriptFinalized,
    );
    if (ws.characterColumnId && ws.frameColumnId && ws.videoColumnId) {
      if (stage !== "style_finalized" && stage !== "finalized") {
        patch.pipelineStage = "style_finalized";
      }
    } else if (ws.styleNodeId && hubFinalized) {
      if (
        stage !== "script_finalized" &&
        stage !== "style_finalized" &&
        stage !== "finalized"
      ) {
        patch.pipelineStage = "script_finalized";
      }
    } else if (hasScriptDraft && stage === "idle") {
      patch.pipelineStage = "llm_done";
    }
    if (Object.keys(patch).length) {
      updateNodeData(id, patch);
    }
  }, [
    isFinalized,
    scriptHub,
    nodes,
    edges,
    id,
    d.workspaceIds,
    stage,
    hasScriptDraft,
    updateNodeData,
  ]);

  useEffect(() => {
    if (!scriptHub) return;
    reflowProLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 挂载时对齐控制行
  }, [id]);

  useEffect(() => {
    if (d.providerId?.trim() && d.modelKey?.trim()) return;
    const pick = pickDefaultStoryLlmEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
    });
  }, [d.providerId, d.modelKey, providers, id, updateNodeData]);

  useEffect(() => {
    const targetH = STORY_PRO_CONTROL_NODE_HEIGHT;
    const targetW = STORY_PRO_CONTROL_NODE_WIDTH;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - targetH) < 4 && Math.abs(w - targetW) < 4) return;
    resizeNode(id, { width: targetW, height: targetH });
  }, [id, resizeNode]);

  const onSavePrompt = useCallback(
    (next: { systemPrompt: string; systemPromptTemplateId?: string }) => {
      updateNodeData(id, {
        systemPrompt: next.systemPrompt,
        systemPromptTemplateId: next.systemPromptTemplateId,
      });
      if (scriptHub) {
        syncStoryProHubFromStarter({
          starterNodeId: id,
          systemPrompt: next.systemPrompt,
          providerId: d.providerId,
          modelKey: d.modelKey,
          params: d.params ?? {},
          scriptHubId: scriptHub.scriptHubId,
          updateNodeData,
        });
      }
    },
    [id, scriptHub, d.providerId, d.modelKey, d.params, updateNodeData],
  );

  const onPickEngine = (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => {
    updateNodeData(id, {
      providerId: next.providerId,
      modelKey: next.modelKey,
      params: next.params,
    });
    if (scriptHub) {
      syncStoryProHubFromStarter({
        starterNodeId: id,
        systemPrompt,
        providerId: next.providerId,
        modelKey: next.modelKey,
        params: next.params ?? {},
        scriptHubId: scriptHub.scriptHubId,
        updateNodeData,
      });
    }
  };

  useEffect(() => {
    if (d.uploadedScriptMd?.trim() || !d.uploadedScriptOssUrl?.trim()) return;
    let cancelled = false;
    setScriptLoadBusy(true);
    void fetchUploadedScriptFromOss(d.uploadedScriptOssUrl)
      .then((md) => {
        if (!cancelled) updateNodeData(id, { uploadedScriptMd: md });
      })
      .catch((e) => {
        if (!cancelled) {
          console.warn("[story-pro-starter] load script from OSS failed", e);
        }
      })
      .finally(() => {
        if (!cancelled) setScriptLoadBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [d.uploadedScriptOssUrl, d.uploadedScriptMd, id, updateNodeData]);

  const ingestScriptFile = async (file: File) => {
    if (fieldsLocked) return;
    setUploadBusy(true);
    try {
      const parsed = await parseStoryProUploadScriptFile(file);
      if (!parsed.ok) {
        window.alert(parsed.error);
        return;
      }
      let ossUrl = "";
      try {
        const blob = new Blob([parsed.md], {
          type:
            parsed.meta.format === "txt"
              ? "text/plain;charset=utf-8"
              : "text/markdown;charset=utf-8",
        });
        const uploadFile = new File([blob], parsed.meta.fileName, {
          type: blob.type,
        });
        ossUrl = await uploadCanvasFile(base, uploadFile);
      } catch (e) {
        window.alert(
          e instanceof Error
            ? `剧本上传云端失败：${e.message}`
            : "剧本上传云端失败",
        );
        return;
      }
      updateNodeData(id, {
        starterMode: "upload",
        uploadedScriptMd: parsed.md,
        uploadedScriptOssUrl: ossUrl,
        uploadedScriptMeta: parsed.meta,
      });
    } finally {
      setUploadBusy(false);
    }
  };

  const ensureScriptMdLoaded = async (): Promise<boolean> => {
    const latest = useCanvasStore.getState().nodes.find((n) => n.id === id)
      ?.data as StoryProStarterNodeData | undefined;
    if (latest?.uploadedScriptMd?.trim()) return true;
    if (!latest?.uploadedScriptOssUrl?.trim()) return Boolean(upstreamScript);
    try {
      const md = await fetchUploadedScriptFromOss(latest.uploadedScriptOssUrl);
      updateNodeData(id, { uploadedScriptMd: md });
      return true;
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "无法从云端读取剧本，请稍后重试",
      );
      return false;
    }
  };

  const clearUploadedScript = () => {
    if (fieldsLocked || !hasUploadedScript) return;
    const name = d.uploadedScriptMeta?.fileName ?? "上传剧本";
    if (!window.confirm(`移除已上传的「${name}」？`)) return;
    if (
      !window.confirm(
        "移除后需重新上传才能解析；此操作不可恢复。确定继续？",
      )
    ) {
      return;
    }
    updateNodeData(id, {
      uploadedScriptMd: "",
      uploadedScriptOssUrl: "",
      uploadedScriptMeta: undefined,
    });
  };

  const onPickScriptFile = () => {
    if (fieldsLocked) return;
    fileInputRef.current?.click();
  };

  const onScriptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await ingestScriptFile(file);
  };

  const onScriptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (fieldsLocked) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void ingestScriptFile(file);
  };

  const onParseScript = async () => {
    if (!canRun || isGenerating) return;
    const ready = await ensureScriptMdLoaded();
    if (!ready) return;
    const state = useCanvasStore.getState();
    const existingHub = findStoryProScriptHubForStarter(
      state.nodes,
      state.edges,
      id,
      d.workspaceIds,
    );
    const scriptHubId = existingHub
      ? existingHub.scriptHubId
      : spawnStoryProScriptHub({
          starterNodeId: id,
          systemPrompt,
          providerId: d.providerId,
          modelKey: d.modelKey,
          params: d.params ?? {},
          nodes: state.nodes,
          edges: state.edges,
          addNode: (type, position, nodeData) =>
            addNode(type, position, nodeData),
          setEdges,
          updateNodeData,
        }).scriptHubId;
    syncStoryProHubFromStarter({
      starterNodeId: id,
      systemPrompt,
      providerId: d.providerId,
      modelKey: d.modelKey,
      params: d.params ?? {},
      scriptHubId,
      updateNodeData,
    });
    if (!existingHub) {
      reflowProLayout();
    }
    runStoryHubSectionsSequential(scriptHubId, STORY_PRO_HUB_SECTION_ORDER, {
      forceFresh: hasScriptDraft,
    });
  };

  return (
    <>
      <ProNodeShell
        title="影视专业 · 启动"
        subtitle={STAGE_LABELS[stage] ?? STAGE_LABELS.idle}
        selected={selected}
        guide={<StoryProGuidePanel stage="starter" />}
        minWidth={STORY_PRO_CONTROL_NODE_WIDTH}
        minHeight={STORY_PRO_CONTROL_NODE_HEIGHT}
        inputs={[{ id: "in_text", label: "剧本", kind: "text" }]}
        outputs={[{ id: "text", label: "创意", kind: "text" }]}
        headerRight={
          <NodeStatusBadge
            status={scriptHub ? hubStatus.status : "idle"}
            message={hubStatus.failMessage}
          />
        }
        footer={
          <div className="nodrag flex w-full flex-col gap-2">
            <div className="shrink-0 space-y-1.5 border-b border-cyan-400/10 pb-2">
              <p className={PRO_HINT_LABEL_CLASS}>LLM 模型（全工作流共用）</p>
              <div
                className={
                  isFinalized ? "pointer-events-none opacity-50" : undefined
                }
              >
                <EnginePicker
                  role="LLM"
                  allowedModelKeys={[...STORY_LLM_MODEL_KEYS]}
                  providerId={d.providerId ?? ""}
                  modelKey={d.modelKey ?? ""}
                  params={d.params ?? {}}
                  onChange={onPickEngine}
                />
              </div>
            </div>
            <StoryNodeFooterShell
              hint={
                <span className="flex items-center gap-1 text-cyan-200/60">
                  <Sparkles className="size-3 shrink-0" />
                  {hasScriptSource
                    ? "自动连接「故事剧本」"
                    : "请先上传剧本"}
                </span>
              }
            >
              <button
                type="button"
                disabled={!canRun || isGenerating}
                className={PRO_NODE_ACTION_BTN_CLASS}
                onClick={() => void onParseScript()}
              >
                {isFinalized ? (
                  <>
                    <Lock className="size-3.5" /> 工作流已定稿
                  </>
                ) : isGenerating ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" /> 解析中…
                  </>
                ) : hasScriptDraft ? (
                  <>
                    <RefreshCw className="size-3.5" /> 重新解析
                  </>
                ) : (
                  <>
                    <PenLine className="size-3.5" /> 解析剧本
                  </>
                )}
              </button>
            </StoryNodeFooterShell>
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2.5">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={`${PRO_TEMPLATE_CHIP_CLASS} border-cyan-400/45 bg-cyan-500/20`}
            >
              上传剧本
            </button>
            <button
              type="button"
              disabled
              title="预留：连接「创作剧本」节点（快手式 LLM 生成）"
              className={`${PRO_TEMPLATE_CHIP_CLASS} opacity-40`}
            >
              创作剧本 · 敬请期待
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={STORY_PRO_UPLOAD_SCRIPT_ACCEPT}
            className="hidden"
            onChange={(e) => void onScriptFileChange(e)}
          />

          <div
            className={`space-y-1 rounded-md transition ${
              dragOver ? "ring-2 ring-cyan-400/50 ring-offset-1 ring-offset-black/40" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!fieldsLocked) setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={onScriptDrop}
          >
            <span className={PRO_HINT_LABEL_CLASS}>
              剧本文件 · 拖入 / 点击 · .md / .txt（UTF-8）
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={fieldsLocked || uploadBusy || scriptLoadBusy}
                onClick={onPickScriptFile}
                className={`nodrag inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-1.5 rounded border border-dashed px-2 py-2 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  dragOver
                    ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-50"
                    : "border-cyan-400/30 bg-cyan-500/8 text-cyan-100/90 hover:border-cyan-400/50 hover:bg-cyan-500/14"
                }`}
              >
                <FileUp className="size-3.5 shrink-0" />
                {uploadBusy
                  ? "上传云端中…"
                  : scriptLoadBusy
                    ? "读取剧本中…"
                    : hasUploadedScript
                      ? `已上传 · ${d.uploadedScriptMeta?.fileName ?? "剧本"}`
                      : dragOver
                        ? "松开即可上传"
                        : "拖入或点击上传剧本"}
              </button>
              {hasUploadedScript ? (
                <>
                  <button
                    type="button"
                    disabled={!d.uploadedScriptMd?.trim() && scriptLoadBusy}
                    className="nodrag rounded border border-cyan-400/25 bg-black/30 px-2 py-2 text-[11px] text-cyan-100/90 hover:bg-cyan-500/10 disabled:opacity-45"
                    onClick={() => setScriptPreviewOpen(true)}
                  >
                    <Eye className="inline size-3.5" /> 预览
                  </button>
                  {!fieldsLocked ? (
                    <button
                      type="button"
                      className="nodrag rounded border border-white/10 bg-black/30 px-2 py-2 text-[11px] text-white/60 hover:bg-red-500/10 hover:text-red-200"
                      onClick={clearUploadedScript}
                      aria-label="移除上传剧本"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            {starterMode === "upload" && !hasUploadedScript && !upstreamScript ? (
              <p className="text-[10px] leading-relaxed text-cyan-200/45">
                推荐 Markdown：用 ## 分场；正文存 OSS，画布 autosave 只保留链接。
                左侧「剧本」口可接未来的「创作剧本」节点。
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
            <p className={PRO_HINT_LABEL_CLASS}>
              导演提示词 · 输入 @ 引用上传剧本
            </p>
            <StoryThemePromptPreviewPane
              displayMd={promptPreviewMd}
              emptyHint="点击预览区编辑导演提示词"
              disabled={isGenerating}
              onOpen={() => setPromptModalOpen(true)}
            />
          </div>
        </div>
      </ProNodeShell>

      <StoryThemePromptModal
        open={promptModalOpen}
        initialTab={d.systemPromptTemplateId ?? "director-from-script"}
        templateId={d.systemPromptTemplateId}
        templates={STORY_PRO_THEME_SYSTEM_PROMPT_TEMPLATES}
        dialogTitle="影视专业版 · 导演提示词"
        mentionables={scriptMentionables}
        editHint="输入 @ 插入「上传剧本」引用 · 运行时会自动附带全文 · 输出须含角色表+分镜表"
        proDirectorPack
        onClose={() => setPromptModalOpen(false)}
        value={systemPrompt}
        onSave={onSavePrompt}
        readOnly={promptEditLocked}
      />

      <StoryProScriptUploadPreviewModal
        open={scriptPreviewOpen}
        onClose={() => setScriptPreviewOpen(false)}
        md={d.uploadedScriptMd ?? ""}
        meta={d.uploadedScriptMeta}
      />
    </>
  );
}
