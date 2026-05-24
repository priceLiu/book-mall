"use client";

import { useCallback, useEffect, useRef } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listCanvasProjectTasks,
  runCanvasNode,
  type CanvasTaskRecord,
} from "@/lib/canvas-api";
import { useCanvasStore } from "./store";
import { directPredecessors } from "./topo";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  ImageNodeData,
  ImageEngineNodeData,
  TextNodeData,
  AiEngineNodeData,
  StoryEngineNodeData,
  StoryComicStarterNodeData,
} from "./types";
import { isStoryLlmNodeType } from "./types";
import { formatCanvasTaskError } from "./friendly-task-error";
import {
  registerCanvasRunBus,
  unregisterCanvasRunBus,
} from "./canvas-run-bus";
import {
  storyLlmNodeIsComplete,
  storyLlmNodeNeedsRun,
} from "./story-llm-runtime";
import {
  pickRuntimeImagePreviewUrl,
  pickTaskImagePreviewUrl,
  pickTaskModelDownloadUrl,
} from "./task-media-url";

const POLL_INTERVAL_MS = 2000;
/** 每 N 次 tick 做一次全项目任务扫描，避免刷新后 runtime 丢失导致轮询停住 */
const FULL_SCAN_EVERY_N_TICKS = 3;

function nodeRuntimeStatus(node: CanvasFlowNode): string | undefined {
  return (node.data as { runtime?: { status?: string } }).runtime?.status;
}

function isLocalInflightStatus(status?: string): boolean {
  return status === "pending" || status === "running";
}

function isServerInflightStatus(status?: string): boolean {
  return status === "PENDING" || status === "SUBMITTED";
}

function latestTasksByNode(
  tasks: CanvasTaskRecord[],
): Map<string, CanvasTaskRecord> {
  const latestByNode = new Map<string, CanvasTaskRecord>();
  for (const t of tasks) {
    const prev = latestByNode.get(t.nodeId);
    if (
      !prev ||
      new Date(t.updatedAt).getTime() > new Date(prev.updatedAt).getTime()
    ) {
      latestByNode.set(t.nodeId, t);
    }
  }
  return latestByNode;
}

/** 顶部工具栏：进行中的节点数（pending + running） */
export function useCanvasInflightTaskCount(): number {
  return useCanvasStore(
    (s) =>
      s.nodes.filter((n) => isLocalInflightStatus(nodeRuntimeStatus(n))).length,
  );
}

/** 解析单个生图引擎节点上游的图片 URL 列表（保持顺序去重）。 */
function resolveImageInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string[] {
  const out: string[] = [];
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (p.type === "image") {
      const d = p.data as unknown as ImageNodeData;
      if (d.ossUrl) out.push(d.ossUrl);
    } else if (p.type === "image-engine" || p.type === "three-view-engine" || p.type === "video-engine") {
      const d = p.data as unknown as ImageEngineNodeData;
      const url =
        pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ?? d.runtime?.ossUrl;
      if (url) out.push(url);
    } else if (p.type === "tts-engine") {
      const d = p.data as unknown as { runtime?: { ossUrl?: string } };
      if (d.runtime?.ossUrl) out.push(d.runtime.ossUrl);
    }
  }
  return Array.from(new Set(out));
}

/** ai-engine / story LLM 完成时，把 textOutput 写入下游 text / md-preview 依赖的 text 节点 */
function propagateTextOutputToDownstream(
  nodeId: string,
  textOutput: string,
  setNodeRuntime: (id: string, runtime: Partial<{ textOutput: string }>) => void,
) {
  const state = useCanvasStore.getState();
  const downstream: string[] = state.edges
    .filter((e) => e.source === nodeId)
    .map((e) => e.target);
  for (const tid of downstream) {
    const t = state.nodes.find((n) => n.id === tid);
    if (!t) continue;
    if (t.type !== "text") continue;
    const td = t.data as unknown as TextNodeData;
    if (td.mode === "manual" && (td.text ?? "").trim()) continue;
    setNodeRuntime(tid, { textOutput });
  }
}

/** @deprecated alias */
function propagateAiOutputToDownstreamText(
  nodeId: string,
  textOutput: string,
  setNodeRuntime: (id: string, runtime: Partial<{ textOutput: string }>) => void,
) {
  propagateTextOutputToDownstream(nodeId, textOutput, setNodeRuntime);
}

/** 解析单个节点的 textInputs（按入边出现顺序拼接）。 */
function resolveTextInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string[] {
  const out: string[] = [];
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (p.type === "text") {
      const d = p.data as unknown as TextNodeData;
      // 双向文本：piped 模式优先用 runtime.textOutput；否则用 d.text
      if (d.mode === "piped" && d.runtime?.textOutput?.trim()) {
        out.push(d.runtime.textOutput.trim());
      } else if (d.text?.trim()) {
        out.push(d.text.trim());
      }
    } else if (p.type === "ai-engine" || isStoryLlmNodeType(p.type ?? "")) {
      const d = p.data as unknown as AiEngineNodeData | StoryEngineNodeData;
      if (d.runtime?.textOutput?.trim()) out.push(d.runtime.textOutput.trim());
    } else if (p.type === "story-comic-starter") {
      const d = p.data as unknown as StoryComicStarterNodeData;
      if (d.theme?.trim()) out.push(d.theme.trim());
    }
  }
  return out;
}

/**
 * 运行队列 + 5s 任务轮询 hook。
 * 在 canvas page 挂载一次即可。
 */
export function useCanvasRunner(fallbackProjectId?: string) {
  const base = useBookMallBaseUrl();
  const storeProjectId = useCanvasStore((s) => s.projectId);
  const projectId = storeProjectId ?? fallbackProjectId ?? null;
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);

  const queueRef = useRef<Array<{ nodeId: string; forceFresh?: boolean }>>(
    [],
  );
  const inflightRef = useRef<Set<string>>(new Set());
  const taskByNodeRef = useRef<Map<string, string>>(new Map());
  const sequentialRef = useRef<{
    nodeIds: string[];
    cursor: number;
    forceFresh?: boolean;
    activeNodeId: string | null;
  } | null>(null);
  const drainRef = useRef<() => void>(() => {});
  const pumpSequentialRef = useRef<() => void>(() => {});

  const abortSequential = useCallback(
    (nodeId?: string, message?: string) => {
      if (nodeId && message) {
        setNodeRuntime(nodeId, {
          status: "error",
          failCode: "RUN_ABORTED",
          failMessage: formatCanvasTaskError("RUN_ABORTED", message),
        });
      }
      sequentialRef.current = null;
    },
    [setNodeRuntime],
  );

  const pumpSequential = useCallback(() => {
    const seq = sequentialRef.current;
    if (!seq) return;
    if (seq.cursor >= seq.nodeIds.length) {
      sequentialRef.current = null;
      return;
    }
    if (seq.activeNodeId) return;

    const nodeId = seq.nodeIds[seq.cursor]!;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (!node) {
      abortSequential(
        nodeId,
        "找不到文案引擎节点，请刷新页面或重新载入漫剧模板",
      );
      return;
    }
    const st = nodeRuntimeStatus(node);
    // 仅跳过真正有输出的 Story LLM；空 done / error 必须重跑
    if (
      !seq.forceFresh &&
      st === "done" &&
      !storyLlmNodeNeedsRun(node, false)
    ) {
      seq.cursor += 1;
      seq.activeNodeId = null;
      pumpSequential();
      return;
    }

    seq.activeNodeId = nodeId;
    setNodeRuntime(nodeId, {
      status: "pending",
      failCode: undefined,
      failMessage: undefined,
    });
    queueRef.current.push({ nodeId, forceFresh: seq.forceFresh });
    drainRef.current();
  }, [abortSequential, setNodeRuntime]);

  useEffect(() => {
    pumpSequentialRef.current = pumpSequential;
  }, [pumpSequential]);

  const runOne = useCallback(
    async (nodeId: string, forceFresh?: boolean) => {
      if (!base || !projectId) {
        setNodeRuntime(nodeId, {
          status: "error",
          failCode: "NOT_READY",
          failMessage: formatCanvasTaskError(
            "NOT_READY",
            "画布未就绪，请刷新页面后重试",
          ),
        });
        abortSequential();
        return;
      }
      const state = useCanvasStore.getState();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) {
        setNodeRuntime(nodeId, {
          status: "error",
          failCode: "NODE_NOT_FOUND",
          failMessage: formatCanvasTaskError(
            "NODE_NOT_FOUND",
            "找不到该节点，请刷新页面",
          ),
        });
        abortSequential();
        return;
      }

      const imageInputs = resolveImageInputs(state.nodes, state.edges, nodeId);
      const textInputs = resolveTextInputs(state.nodes, state.edges, nodeId);

      try {
        const data = node.data as Record<string, unknown>;
        const modelKey = typeof data.modelKey === "string" ? data.modelKey : undefined;
        const r = await runCanvasNode(base, projectId, nodeId, {
          node: {
            type: node.type ?? "image-engine",
            modelKey,
            data,
            imageInputs,
            textInputs,
          },
          forceFresh,
        });
        taskByNodeRef.current.set(nodeId, r.task.id);
        if (
          r.task.status === "SUCCEEDED" &&
          (r.task.ossUrl ||
            r.task.textOutput ||
            pickTaskImagePreviewUrl(r.task) ||
            pickTaskModelDownloadUrl(r.task))
        ) {
          // ai-engine 同步成功 / 缓存命中 / image-engine 同步出图：直接落 done
          setNodeRuntime(nodeId, {
            status: "done",
            taskId: r.task.id,
            ossUrl:
              pickTaskImagePreviewUrl(r.task) ?? r.task.ossUrl ?? undefined,
            ephemeralUrl: r.task.ephemeralUrl ?? undefined,
            textOutput: r.task.textOutput ?? undefined,
          });
          if (r.task.textOutput && (node.type === "ai-engine" || isStoryLlmNodeType(node.type ?? ""))) {
            propagateTextOutputToDownstream(
              nodeId,
              r.task.textOutput,
              setNodeRuntime,
            );
          }
        } else if (r.task.status === "FAILED") {
          setNodeRuntime(nodeId, {
            status: "error",
            taskId: r.task.id,
            failCode: r.task.failCode ?? "FAILED",
            failMessage: formatCanvasTaskError(
              r.task.failCode,
              r.task.failMessage,
            ),
          });
        } else {
          setNodeRuntime(nodeId, {
            status: "running",
            taskId: r.task.id,
            failCode: undefined,
            failMessage: undefined,
          });
          // 提交后立即拉一次任务（服务端 tasks GET 会 opportunistic poll KIE）
          void listCanvasProjectTasks(base, projectId, [nodeId])
            .then((tasks) => {
              const latest = tasks.sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime(),
              )[0];
              if (!latest) return;
              if (
                latest.status === "SUCCEEDED" &&
                (latest.ossUrl ||
                  latest.textOutput ||
                  pickTaskImagePreviewUrl(latest) ||
                  pickTaskModelDownloadUrl(latest))
              ) {
                setNodeRuntime(nodeId, {
                  status: "done",
                  taskId: latest.id,
                  ossUrl:
                    pickTaskImagePreviewUrl(latest) ?? latest.ossUrl ?? undefined,
                  ephemeralUrl: latest.ephemeralUrl ?? undefined,
                  textOutput: latest.textOutput ?? undefined,
                });
              } else if (latest.status === "FAILED") {
                setNodeRuntime(nodeId, {
                  status: "error",
                  taskId: latest.id,
                  failCode: latest.failCode ?? "FAILED",
                  failMessage: formatCanvasTaskError(
                    latest.failCode,
                    latest.failMessage,
                  ),
                });
              }
            })
            .catch(() => {});
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setNodeRuntime(nodeId, {
          status: "error",
          failCode: "REQUEST_FAILED",
          failMessage: formatCanvasTaskError("REQUEST_FAILED", msg),
        });
      } finally {
        inflightRef.current.delete(nodeId);
        const seq = sequentialRef.current;
        if (seq?.activeNodeId === nodeId) {
          const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
          const st = node ? nodeRuntimeStatus(node) : undefined;
          if (st === "error") {
            seq.activeNodeId = null;
            sequentialRef.current = null;
          } else if (st === "done") {
            if (
              node &&
              isStoryLlmNodeType(node.type ?? "") &&
              !storyLlmNodeIsComplete(node)
            ) {
              // 等 textOutput 落库后再推进顺序链
            } else {
              seq.activeNodeId = null;
              seq.cursor += 1;
              pumpSequentialRef.current();
            }
          }
        }
        drainRef.current();
      }
    },
    [abortSequential, base, projectId, setNodeRuntime],
  );

  const drain = useCallback(() => {
    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      if (inflightRef.current.has(item.nodeId)) continue;
      inflightRef.current.add(item.nodeId);
      void runOne(item.nodeId, item.forceFresh);
    }
  }, [runOne]);

  useEffect(() => {
    drainRef.current = drain;
  }, [drain]);

  const enqueueNode = useCallback(
    (nodeId: string, forceFresh?: boolean) => {
      if (inflightRef.current.has(nodeId)) return;
      if (queueRef.current.some((q) => q.nodeId === nodeId)) return;
      setNodeRuntime(nodeId, {
        status: "pending",
        failCode: undefined,
        failMessage: undefined,
      });
      queueRef.current.push({ nodeId, forceFresh });
      drain();
    },
    [drain, setNodeRuntime],
  );

  const enqueueNodesSequential = useCallback(
    (nodeIds: string[], forceFresh?: boolean) => {
      if (!nodeIds.length) return;
      sequentialRef.current = {
        nodeIds,
        cursor: 0,
        forceFresh,
        activeNodeId: null,
      };
      pumpSequential();
    },
    [pumpSequential],
  );

  const enqueueNodeRef = useRef(enqueueNode);
  const enqueueNodesSequentialRef = useRef(enqueueNodesSequential);
  useEffect(() => {
    enqueueNodeRef.current = enqueueNode;
  }, [enqueueNode]);
  useEffect(() => {
    enqueueNodesSequentialRef.current = enqueueNodesSequential;
  }, [enqueueNodesSequential]);

  useEffect(() => {
    registerCanvasRunBus({
      enqueueNode: (nodeId, forceFresh) =>
        enqueueNodeRef.current(nodeId, forceFresh),
      enqueueNodesSequential: (nodeIds, opts) =>
        enqueueNodesSequentialRef.current(nodeIds, opts?.forceFresh),
    });
    return () => unregisterCanvasRunBus();
  }, []);

  /** 监听节点自己抛的 "canvas:run-node" 事件（兼容旧路径） */
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ nodeId: string; forceFresh?: boolean }>;
      if (!e.detail?.nodeId) return;
      enqueueNode(e.detail.nodeId, e.detail.forceFresh);
    };
    window.addEventListener("canvas:run-node", handler);
    return () => window.removeEventListener("canvas:run-node", handler);
  }, [enqueueNode]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{
        nodeIds: string[];
        forceFresh?: boolean;
      }>;
      if (!e.detail?.nodeIds?.length) return;
      enqueueNodesSequential(e.detail.nodeIds, e.detail.forceFresh);
    };
    window.addEventListener("canvas:run-nodes-sequential", handler);
    return () =>
      window.removeEventListener("canvas:run-nodes-sequential", handler);
  }, [enqueueNodesSequential]);

  /** 异步任务完成时推进顺序链 */
  useEffect(() => {
    return useCanvasStore.subscribe((state) => {
      const seq = sequentialRef.current;
      if (!seq?.activeNodeId) return;
      const node = state.nodes.find((n) => n.id === seq.activeNodeId);
      const st = node ? nodeRuntimeStatus(node) : undefined;
      if (st === "error") {
        seq.activeNodeId = null;
        sequentialRef.current = null;
        return;
      }
      if (st === "done") {
        if (
          node &&
          isStoryLlmNodeType(node.type ?? "") &&
          !storyLlmNodeIsComplete(node)
        ) {
          return;
        }
        seq.activeNodeId = null;
        seq.cursor += 1;
        pumpSequentialRef.current();
      }
    });
  }, []);

  /** 5 秒轮询：同步服务端任务状态；刷新后也能恢复进行中的异步任务 */
  useEffect(() => {
    if (!base || !projectId) return;
    let cancelled = false;
    let tickCount = 0;
    const serverInflightRef = { current: false };
    const applyTaskUpdate = (
      t: CanvasTaskRecord,
      nodeId: string,
      nodes: CanvasFlowNode[],
    ) => {
      const node = nodes.find((n) => n.id === nodeId);
      const localSt = node ? nodeRuntimeStatus(node) : undefined;
      const boundTaskId = taskByNodeRef.current.get(nodeId);
      // POST 尚未返回时，不要用历史 FAILED/SUCCEEDED 覆盖 pending
      if (isLocalInflightStatus(localSt) && !boundTaskId) {
        if (t.status === "FAILED" || t.status === "SUCCEEDED") return;
      }
      if (
        isLocalInflightStatus(localSt) &&
        boundTaskId &&
        t.id !== boundTaskId &&
        (t.status === "FAILED" || t.status === "SUCCEEDED")
      ) {
        return;
      }

      if (
        t.status === "SUCCEEDED" &&
        (t.ossUrl ||
          t.textOutput ||
          pickTaskImagePreviewUrl(t) ||
          pickTaskModelDownloadUrl(t))
      ) {
        setNodeRuntime(nodeId, {
          status: "done",
          taskId: t.id,
          ossUrl: pickTaskImagePreviewUrl(t) ?? t.ossUrl ?? undefined,
          ephemeralUrl: t.ephemeralUrl ?? undefined,
          textOutput: t.textOutput ?? undefined,
        });
        if (t.textOutput) {
          const node = nodes.find((n) => n.id === nodeId);
          if (node?.type === "ai-engine" || isStoryLlmNodeType(node?.type ?? "")) {
            propagateTextOutputToDownstream(
              nodeId,
              t.textOutput,
              setNodeRuntime,
            );
          }
        }
      } else if (t.status === "FAILED") {
        setNodeRuntime(nodeId, {
          status: "error",
          taskId: t.id,
          failCode: t.failCode ?? "FAILED",
          failMessage: formatCanvasTaskError(
            t.failCode,
            t.failMessage,
          ),
        });
      } else if (t.status === "SUBMITTED") {
        setNodeRuntime(nodeId, { status: "running", taskId: t.id });
      } else if (t.status === "PENDING") {
        setNodeRuntime(nodeId, { status: "pending", taskId: t.id });
      }
    };

    const tick = async (forceFullScan = false) => {
      tickCount++;
      const periodicFullScan =
        !forceFullScan && tickCount % FULL_SCAN_EVERY_N_TICKS === 0;
      const fullScan = forceFullScan || periodicFullScan;

      const state = useCanvasStore.getState();
      const localInflight = state.nodes.filter((n) =>
        isLocalInflightStatus(nodeRuntimeStatus(n)),
      );
      const shouldPoll =
        fullScan ||
        localInflight.length > 0 ||
        serverInflightRef.current ||
        inflightRef.current.size > 0 ||
        queueRef.current.length > 0;
      if (!shouldPoll) return;

      const nodeIds =
        fullScan || serverInflightRef.current
          ? undefined
          : localInflight.map((n) => n.id);

      try {
        const tasks = await listCanvasProjectTasks(base, projectId, nodeIds);
        if (cancelled) return;
        const latestByNode = latestTasksByNode(tasks);
        let serverInflight = 0;
        latestByNode.forEach((t, nodeId) => {
          if (isServerInflightStatus(t.status)) serverInflight++;
          applyTaskUpdate(t, nodeId, state.nodes);
        });
        serverInflightRef.current = serverInflight > 0;
      } catch {
        // 网络抖动忽略
      }
    };

    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    void tick(true);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [base, projectId, setNodeRuntime]);

  return { enqueueNode };
}

/** 独立挂载，避免与页面其它 hooks 热更新时顺序错乱。 */
export function CanvasRunnerHost({ projectId }: { projectId: string }) {
  useCanvasRunner(projectId);
  return null;
}
