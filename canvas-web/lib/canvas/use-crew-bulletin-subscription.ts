"use client";

import { useEffect, useRef } from "react";

import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import { getCanvasProject } from "@/lib/canvas-api";
import {
  crewBulletinAnchorFingerprint,
  fingerprintBulletinFromGraphMeta,
  mergeCrewBulletinGraphAnchors,
} from "@/lib/canvas/crew-bulletin-fingerprint";
import type { CrewBulletinGraphAnchor } from "@/lib/canvas/crew-bulletin-graph-anchor";
import { enrichCrewBulletinGraphAnchorRows } from "@/lib/canvas/crew-bulletin-graph-anchor";
import { migrateGraphV1ToV2 } from "@/lib/canvas/migrate";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasGraph } from "@/lib/canvas/types";

const POLL_MS = 8_000;
const FETCH_TIMEOUT_MS = 12_000;
const BROADCAST_CHANNEL = "canvas-crew-bulletin-sync";

type TaskSyncPayload = {
  projectId?: string;
  bulletinFingerprint?: string;
  projectUpdatedAt?: string | null;
};

function mergeRemoteWorkNodes(
  localNodes: CanvasFlowNode[],
  localEdges: CanvasFlowEdge[],
  remoteGraph: CanvasGraph,
  anchor: CrewBulletinGraphAnchor,
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const taskNodeIds = new Set(
    anchor.crewBulletin.tasks
      .map((t) => t.canvasNodeId)
      .filter((id): id is string => Boolean(id)),
  );
  if (taskNodeIds.size === 0) {
    return { nodes: localNodes, edges: localEdges };
  }

  const localIds = new Set(localNodes.map((n) => n.id));
  const missingNodes = remoteGraph.nodes.filter(
    (n) => taskNodeIds.has(n.id) && !localIds.has(n.id),
  );
  if (!missingNodes.length) {
    return { nodes: localNodes, edges: localEdges };
  }

  const missingIds = new Set(missingNodes.map((n) => n.id));
  const missingEdges = remoteGraph.edges.filter(
    (e) => missingIds.has(e.source) || missingIds.has(e.target),
  );
  const edgeIds = new Set(localEdges.map((e) => e.id));
  const edgesToAdd = missingEdges.filter((e) => !edgeIds.has(e.id));

  return {
    nodes: [...localNodes, ...missingNodes],
    edges: [...localEdges, ...edgesToAdd],
  };
}

/**
 * 协作画布 · 公告栏订阅（轮询 task-sync 指纹，合并远端领取/提交状态）。
 * 公告条状态存在 graph.meta，随画布 autosave 持久化，多人共享同一项目。
 */
export function useCrewBulletinSubscription(
  base: string | null | undefined,
  projectId: string | null | undefined,
  enabled = true,
): void {
  const lastRemoteFingerprintRef = useRef("");
  const lastRemoteUpdatedAtRef = useRef("");
  const inFlightRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!enabled || !base || !projectId || typeof window === "undefined") {
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    const applyRemoteAnchor = (
      remote: CrewBulletinGraphAnchor,
      remoteGraph?: CanvasGraph,
    ) => {
      const enriched = enrichCrewBulletinGraphAnchorRows(remote);
      const state = useCanvasStore.getState();

      if (remoteGraph) {
        const merged = mergeRemoteWorkNodes(
          state.nodes,
          state.edges,
          remoteGraph,
          enriched,
        );
        if (merged.nodes.length !== state.nodes.length) {
          state.setNodes(() => merged.nodes);
        }
        if (merged.edges.length !== state.edges.length) {
          state.setEdges(() => merged.edges);
        }
      }

      state.patchGraphMeta((meta) => {
        if (!meta?.crewBulletinAnchor) return meta ?? undefined;
        return {
          ...meta,
          crewBulletinAnchor: mergeCrewBulletinGraphAnchors(
            meta.crewBulletinAnchor,
            enriched,
          ),
        };
      });
    };

    const tick = async () => {
      if (disposed || document.visibilityState === "hidden") {
        schedule(POLL_MS);
        return;
      }
      if (inFlightRef.current) {
        schedule(2000);
        return;
      }

      const localMeta = useCanvasStore.getState().graphMeta;
      if (!localMeta?.crewBulletinAnchor) {
        schedule(POLL_MS);
        return;
      }

      inFlightRef.current = true;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS,
      );

      try {
        const { url } = resolveBookMallBrowserRequest(
          base,
          `/api/canvas/projects/${projectId}/task-sync`,
        );
        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          schedule(POLL_MS);
          return;
        }

        const data = (await res.json()) as TaskSyncPayload;
        if (data.projectId !== projectId) {
          schedule(POLL_MS);
          return;
        }

        const remoteBulletinFp = data.bulletinFingerprint ?? "";
        const remoteUpdatedAt = data.projectUpdatedAt ?? "";

        if (
          !remoteBulletinFp ||
          (remoteBulletinFp === lastRemoteFingerprintRef.current &&
            remoteUpdatedAt === lastRemoteUpdatedAtRef.current)
        ) {
          schedule(POLL_MS);
          return;
        }

        const localFp = fingerprintBulletinFromGraphMeta(localMeta);
        if (
          remoteBulletinFp === localFp &&
          remoteUpdatedAt === lastRemoteUpdatedAtRef.current
        ) {
          lastRemoteFingerprintRef.current = remoteBulletinFp;
          lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
          schedule(POLL_MS);
          return;
        }

        const detail = await getCanvasProject(base, projectId);
        const remoteCanvas = detail.canvas as CanvasGraph | undefined;
        const remoteMeta = remoteCanvas?.meta;
        const remoteAnchor = remoteMeta?.crewBulletinAnchor;
        if (!remoteAnchor || !remoteCanvas) {
          schedule(POLL_MS);
          return;
        }

        const remoteFp = crewBulletinAnchorFingerprint(remoteAnchor);
        if (remoteFp && remoteFp !== localFp) {
          applyRemoteAnchor(
            remoteAnchor,
            migrateGraphV1ToV2(remoteCanvas),
          );
        }

        lastRemoteFingerprintRef.current = remoteBulletinFp;
        lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
      } catch {
        schedule(POLL_MS * 2);
        return;
      } finally {
        window.clearTimeout(timeoutId);
        inFlightRef.current = false;
        schedule(POLL_MS);
      }
    };

    lastRemoteFingerprintRef.current = fingerprintBulletinFromGraphMeta(
      useCanvasStore.getState().graphMeta,
    );

    void tick();

    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule(500);
    };
    document.addEventListener("visibilitychange", onVisibility);

    try {
      channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL);
      channelRef.current.onmessage = (ev: MessageEvent<{ projectId?: string }>) => {
        if (ev.data?.projectId !== projectId) return;
        lastRemoteFingerprintRef.current = "";
        schedule(300);
      };
    } catch {
      channelRef.current = null;
    }

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      channelRef.current?.close();
      channelRef.current = null;
      if (timer) clearTimeout(timer);
    };
  }, [base, projectId, enabled]);
}

/** 本 tab 公告条变更 · 通知同浏览器其他 tab 立即拉取 */
export function broadcastCrewBulletinLocalChange(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    ch.postMessage({ projectId });
    ch.close();
  } catch {
    /* ignore */
  }
}
