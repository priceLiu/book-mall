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
} from "./types";

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
    } else if (p.type === "image-engine" || p.type === "three-view-engine") {
      const d = p.data as unknown as ImageEngineNodeData;
      if (d.runtime?.ossUrl) out.push(d.runtime.ossUrl);
    }
  }
  return Array.from(new Set(out));
}

/** ai-engine 完成时，把 textOutput 写入下游所有 text 节点（mode != manual）。 */
function propagateAiOutputToDownstreamText(
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
    if (td.mode === "manual" && (td.text ?? "").trim()) continue; // 用户已锁定手写
    setNodeRuntime(tid, { textOutput });
  }
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
    } else if (p.type === "ai-engine") {
      const d = p.data as unknown as AiEngineNodeData;
      if (d.runtime?.textOutput?.trim()) out.push(d.runtime.textOutput.trim());
    }
  }
  return out;
}

/**
 * 运行队列 + 5s 任务轮询 hook。
 * 在 canvas page 挂载一次即可。
 */
export function useCanvasRunner() {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);

  const queueRef = useRef<Array<{ nodeId: string; forceFresh?: boolean }>>(
    [],
  );
  const inflightRef = useRef<Set<string>>(new Set());
  const taskByNodeRef = useRef<Map<string, string>>(new Map());

  const runOne = useCallback(
    async (nodeId: string, forceFresh?: boolean) => {
      if (!base || !projectId) return;
      const state = useCanvasStore.getState();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return;

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
          (r.task.ossUrl || r.task.textOutput)
        ) {
          // ai-engine 同步成功 / 缓存命中 / image-engine 同步出图：直接落 done
          setNodeRuntime(nodeId, {
            status: "done",
            taskId: r.task.id,
            ossUrl: r.task.ossUrl ?? undefined,
            textOutput: r.task.textOutput ?? undefined,
          });
          if (r.task.textOutput && node.type === "ai-engine") {
            propagateAiOutputToDownstreamText(
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
            failMessage: r.task.failMessage ?? undefined,
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
                (latest.ossUrl || latest.textOutput)
              ) {
                setNodeRuntime(nodeId, {
                  status: "done",
                  taskId: latest.id,
                  ossUrl: latest.ossUrl ?? undefined,
                  ephemeralUrl: latest.ephemeralUrl ?? undefined,
                  textOutput: latest.textOutput ?? undefined,
                });
              } else if (latest.status === "FAILED") {
                setNodeRuntime(nodeId, {
                  status: "error",
                  taskId: latest.id,
                  failCode: latest.failCode ?? "FAILED",
                  failMessage: latest.failMessage ?? undefined,
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
          failMessage: msg,
        });
      } finally {
        inflightRef.current.delete(nodeId);
        // 队列中下一个上场
        drain();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, projectId, setNodeRuntime],
  );

  const drain = useCallback(() => {
    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      if (inflightRef.current.has(item.nodeId)) continue;
      inflightRef.current.add(item.nodeId);
      void runOne(item.nodeId, item.forceFresh);
    }
  }, [runOne]);

  const enqueueNode = useCallback(
    (nodeId: string, forceFresh?: boolean) => {
      // 标记 pending
      setNodeRuntime(nodeId, { status: "pending", failCode: undefined, failMessage: undefined });
      queueRef.current.push({ nodeId, forceFresh });
      drain();
    },
    [drain, setNodeRuntime],
  );

  /** 监听节点自己抛的 "canvas:run-node" 事件 */
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ nodeId: string; forceFresh?: boolean }>;
      if (!e.detail?.nodeId) return;
      enqueueNode(e.detail.nodeId, e.detail.forceFresh);
    };
    window.addEventListener("canvas:run-node", handler);
    return () => window.removeEventListener("canvas:run-node", handler);
  }, [enqueueNode]);

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
      if (t.status === "SUCCEEDED" && (t.ossUrl || t.textOutput)) {
        setNodeRuntime(nodeId, {
          status: "done",
          taskId: t.id,
          ossUrl: t.ossUrl ?? undefined,
          ephemeralUrl: t.ephemeralUrl ?? undefined,
          textOutput: t.textOutput ?? undefined,
        });
        if (t.textOutput) {
          const node = nodes.find((n) => n.id === nodeId);
          if (node?.type === "ai-engine") {
            propagateAiOutputToDownstreamText(
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
          failMessage: t.failMessage ?? undefined,
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
