"use client";

import { useEffect, useRef } from "react";

import { LIBTV_MEDIA_FIT_VERSION } from "./libtv-node-chrome";
import {
  computeLibtvMediaNodeSize,
  isLibtvMediaNodeBoxStale,
  type LibtvMediaAutoFitProfile,
} from "./libtv-media-node-size";
import { expandLibtvGroupToFitChildren } from "./libtv-group-content-bounds";
import { isPro2StyledGroup } from "./pro2-media-group-meta";
import { relayoutPro2MediaGroup } from "./pro2-media-group-layout";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import { scheduleRelayoutSbv1MediaGroup } from "./sbv1-media-group-layout";
import { useCanvasStore } from "./store";

/** 这些节点 auto-fit 只改自身尺寸，禁止触发组内兄弟重排 */
const SKIP_GROUP_RELAYOUT_ON_FIT = new Set([
  "jianying-auto-render-pro2",
  "jianying-export-pro",
  "jianying-export",
]);

export type { LibtvMediaAutoFitProfile, LibtvMediaNodeSize } from "./libtv-media-node-size";
export {
  computeLibtvMediaNodeSize,
  isLibtvMediaNodeBoxStale,
  resolveLibtvImageCellSize,
} from "./libtv-media-node-size";

export function loadImageNaturalSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => reject(new Error(`failed to load image: ${url}`));
    img.src = url;
  });
}

function loadVideoNaturalSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.playsInline = true;
    video.muted = true;
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };
    video.onloadedmetadata = () => {
      resolve({
        w: video.videoWidth || 1,
        h: video.videoHeight || 1,
      });
      cleanup();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error(`failed to load video metadata: ${url}`));
    };
    video.src = url;
  });
}

export async function probeLibtvMediaNaturalSize(
  url: string,
  kind: "image" | "video",
): Promise<{ w: number; h: number }> {
  return kind === "video"
    ? loadVideoNaturalSize(url)
    : loadImageNaturalSize(url);
}

type UseLibtvMediaNodeAutoFitArgs = {
  nodeId: string;
  mediaUrl?: string;
  /** 视频首帧封面；有则优先用 JPEG 探测，避免打开画布时 N 路 mp4 metadata */
  posterUrl?: string;
  kind: "image" | "video";
  profile: LibtvMediaAutoFitProfile;
  /** 上传/生成中时不探测尺寸 */
  disabled?: boolean;
};

function scheduleIdleWork(work: () => void): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(work, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = window.setTimeout(work, 48);
  return () => window.clearTimeout(id);
}

function applyFitAndMaybeRelayout(args: {
  nodeId: string;
  parentId?: string;
  profile: LibtvMediaAutoFitProfile;
  size: { width: number; height: number };
  fitKey: string;
  naturalW: number;
  naturalH: number;
}) {
  const applyLibtvMediaFit = useCanvasStore.getState().applyLibtvMediaFit;
  const setNodes = useCanvasStore.getState().setNodes;
  applyLibtvMediaFit(args.nodeId, args.size, {
    mediaFit: true,
    mediaFitKey: args.fitKey,
    mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
    mediaNaturalW: args.naturalW,
    mediaNaturalH: args.naturalH,
  });

  const state = useCanvasStore.getState();
  const self = state.nodes.find((n) => n.id === args.nodeId);
  const parentGroup = args.parentId
    ? state.nodes.find((n) => n.id === args.parentId)
    : undefined;
  const parentManualSize = Boolean(
    (parentGroup?.data as { manualSize?: boolean } | undefined)?.manualSize,
  );

  // 自动成片等：成片比例变化后只撑大组框，禁止宫格重排把组内节点叠乱
  if (
    self?.type &&
    SKIP_GROUP_RELAYOUT_ON_FIT.has(self.type) &&
    args.parentId &&
    parentGroup &&
    !parentManualSize
  ) {
    setNodes((nodes) => expandLibtvGroupToFitChildren(nodes, args.parentId!));
    return;
  }

  if (
    !parentManualSize &&
    args.parentId &&
    parentGroup &&
    isSbv1MediaGroup(parentGroup, state.nodes) &&
    (args.profile === "sbv1-video" || args.profile === "sbv1-media")
  ) {
    scheduleRelayoutSbv1MediaGroup(
      setNodes,
      args.parentId,
      () => useCanvasStore.getState().edges,
    );
  } else if (
    !parentManualSize &&
    args.parentId &&
    parentGroup &&
    isPro2StyledGroup(parentGroup, state.nodes)
  ) {
    relayoutPro2MediaGroup(setNodes, args.parentId);
  }
}

/**
 * LibTV 媒体节点 · 有图/有视频后按真实宽高比自动改节点尺寸。
 * - 空态：保持 NODE_DEFAULT_SIZE / 常量默认尺寸
 * - 新媒体到达：始终重算（即使用户曾手动拉伸）
 * - sbv1 媒体组内参考图：组 relayout 仍用统一宫格，跳过自动适配
 */
export function useLibtvMediaNodeAutoFit({
  nodeId,
  mediaUrl,
  posterUrl,
  kind,
  profile,
  disabled = false,
}: UseLibtvMediaNodeAutoFitArgs) {
  const setNodes = useCanvasStore((s) => s.setNodes);
  const edges = useCanvasStore((s) => s.edges);
  const parentId = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === nodeId)?.parentId,
  );
  const mediaFitKey = useCanvasStore(
    (s) =>
      (s.nodes.find((n) => n.id === nodeId)?.data as { mediaFitKey?: string })
        ?.mediaFitKey,
  );
  const mediaFit = useCanvasStore(
    (s) =>
      Boolean(
        (s.nodes.find((n) => n.id === nodeId)?.data as { mediaFit?: boolean })
          ?.mediaFit,
      ),
  );
  const mediaFitVersion = useCanvasStore(
    (s) =>
      (
        s.nodes.find((n) => n.id === nodeId)?.data as {
          mediaFitVersion?: number;
        }
      )?.mediaFitVersion,
  );
  const nodeWidth = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === nodeId)?.width,
  );
  const nodeHeight = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === nodeId)?.height,
  );
  /** 分镜图组等 Pro2 媒体组 · 尺寸由组 relayout 决定，禁止 auto-fit 撑破宫格 */
  const skipForPro2GroupImage = useCanvasStore((s) => {
    if (kind !== "image" || !parentId) return false;
    const self = s.nodes.find((n) => n.id === nodeId);
    const isGridSplitCrop = Boolean(
      (self?.data as { gridSplitCrop?: unknown } | undefined)?.gridSplitCrop,
    );
    if (isGridSplitCrop) return false;
    const parentGroup = s.nodes.find((n) => n.id === parentId);
    return Boolean(parentGroup && isPro2StyledGroup(parentGroup, s.nodes));
  });

  const skipForHdGridSplitPlaceholder = useCanvasStore((s) => {
    const self = s.nodes.find((n) => n.id === nodeId);
    const d = self?.data as {
      pro2HdFromGridSplit?: boolean;
      gridSplitCrop?: unknown;
      gridSplitFrameCrop?: boolean;
    };
    return Boolean(
      d?.pro2HdFromGridSplit && d?.gridSplitCrop && !d?.gridSplitFrameCrop,
    );
  });

  const lastFitKey = useRef("");
  const lastAppliedSize = useRef("");

  useEffect(() => {
    const url = mediaUrl?.trim();
    if (!url || disabled || skipForPro2GroupImage || skipForHdGridSplitPlaceholder) return;

    const selfNodeEarly = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    const aspectPreset = (
      selfNodeEarly?.data as { mediaAspectPreset?: string } | undefined
    )?.mediaAspectPreset?.trim();
    if (aspectPreset) return;

    const poster = posterUrl?.trim();
    const probeUrl = kind === "video" && poster ? poster : url;
    const probeKind: "image" | "video" =
      kind === "video" && poster ? "image" : kind;
    const fitKey = `${probeKind}|${probeUrl}|${profile}`;

    const fitVersionStale = mediaFitVersion !== LIBTV_MEDIA_FIT_VERSION;
    const profileStale = Boolean(
      mediaFitKey && !mediaFitKey.endsWith(`|${profile}`),
    );
    const selfNode = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    const boxStale = selfNode
      ? isLibtvMediaNodeBoxStale(selfNode, profile)
      : false;
    const needsRefit = fitVersionStale || profileStale || boxStale;

    const storedNatural = selfNode?.data as {
      mediaNaturalW?: number;
      mediaNaturalH?: number;
    };
    if (
      boxStale &&
      typeof storedNatural?.mediaNaturalW === "number" &&
      typeof storedNatural?.mediaNaturalH === "number" &&
      storedNatural.mediaNaturalW >= 1 &&
      storedNatural.mediaNaturalH >= 1
    ) {
      const size = computeLibtvMediaNodeSize(
        storedNatural.mediaNaturalW,
        storedNatural.mediaNaturalH,
        profile,
      );
      const sizeKey = `${size.width}x${size.height}`;
      if (lastAppliedSize.current !== sizeKey || boxStale) {
        applyFitAndMaybeRelayout({
          nodeId,
          parentId,
          profile,
          size,
          fitKey,
          naturalW: storedNatural.mediaNaturalW,
          naturalH: storedNatural.mediaNaturalH,
        });
        lastAppliedSize.current = sizeKey;
      }
      lastFitKey.current = fitKey;
      return;
    }

    // mediaFitKey 须含 probe 源（含 poster），否则封面到达后不会重算 stage 比例
    if (mediaFit && mediaFitKey === fitKey && !needsRefit) {
      lastFitKey.current = fitKey;
      return;
    }
    if (lastFitKey.current === fitKey && !needsRefit) return;

    let cancelled = false;

    const cancelIdle = scheduleIdleWork(() => {
      void (async () => {
        try {
          const { w, h } = await probeLibtvMediaNaturalSize(probeUrl, probeKind);
          if (cancelled) return;
          const size = computeLibtvMediaNodeSize(w, h, profile);
          applyFitAndMaybeRelayout({
            nodeId,
            parentId,
            profile,
            size,
            fitKey,
            naturalW: w,
            naturalH: h,
          });
          lastAppliedSize.current = `${size.width}x${size.height}`;
          lastFitKey.current = fitKey;
        } catch {
          // 探测失败时保留当前尺寸
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [
    nodeId,
    mediaUrl,
    posterUrl,
    kind,
    profile,
    disabled,
    skipForPro2GroupImage,
    skipForHdGridSplitPlaceholder,
    parentId,
    mediaFit,
    mediaFitKey,
    mediaFitVersion,
    nodeWidth,
    nodeHeight,
    edges,
    setNodes,
  ]);
}

/** 组布局 / 工具条：是否已按媒体适配过尺寸 */
export function libtvNodeHasMediaFit(node: {
  data?: unknown;
}): boolean {
  return Boolean((node.data as { mediaFit?: boolean })?.mediaFit);
}

/** @deprecated 请从 `libtv-node-chrome` 导入；保留 re-export 兼容历史 import 路径 */
export { LIBTV_MEDIA_FIT_VERSION } from "./libtv-node-chrome";
