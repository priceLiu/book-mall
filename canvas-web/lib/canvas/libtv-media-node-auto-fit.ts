"use client";

import { useEffect, useRef } from "react";

import { LIBTV_MEDIA_NODE_HEADER_HEIGHT } from "./libtv-node-chrome";
import { isPro2StyledGroup } from "./pro2-media-group-meta";
import { relayoutPro2MediaGroup } from "./pro2-media-group-layout";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import { relayoutSbv1MediaGroup } from "./sbv1-media-group-layout";
import {
  SBV1_IMAGE_NODE_MIN_HEIGHT,
  SBV1_IMAGE_NODE_MIN_WIDTH,
  SBV1_VIDEO_ENGINE_MIN_WIDTH,
  SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT,
} from "./sbv1-node-chrome";
import {
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import { useCanvasStore } from "./store";

export type LibtvMediaAutoFitProfile = "square-image" | "sbv1-video";

export type LibtvMediaNodeSize = {
  width: number;
  height: number;
};

function loadImageNaturalSize(url: string): Promise<{ w: number; h: number }> {
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

/** 按媒体宽高比计算 LibTV 媒体卡外框尺寸（含标题栏） */
export function computeLibtvMediaNodeSize(
  naturalWidth: number,
  naturalHeight: number,
  profile: LibtvMediaAutoFitProfile,
): LibtvMediaNodeSize {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const headerHeight = LIBTV_MEDIA_NODE_HEADER_HEIGHT;

  const defaultWidth =
    profile === "sbv1-video" ? 635 : PRO2_IMAGE_NODE_WIDTH;
  const minWidth =
    profile === "sbv1-video"
      ? SBV1_VIDEO_ENGINE_MIN_WIDTH
      : profile === "square-image"
        ? SBV1_IMAGE_NODE_MIN_WIDTH
        : PRO2_IMAGE_NODE_MIN_WIDTH;
  const minHeight =
    profile === "sbv1-video"
      ? SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT
      : profile === "square-image"
        ? SBV1_IMAGE_NODE_MIN_HEIGHT
        : PRO2_IMAGE_NODE_MIN_HEIGHT;

  let width = defaultWidth;
  let stageHeight = width * (nh / nw);
  let height = headerHeight + stageHeight;

  if (height < minHeight) {
    height = minHeight;
    stageHeight = Math.max(1, height - headerHeight);
    width = stageHeight * (nw / nh);
  }
  if (width < minWidth) {
    width = minWidth;
    stageHeight = width * (nh / nw);
    height = headerHeight + stageHeight;
  }

  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
  };
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
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
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
  const skipForSbv1GroupImage = useCanvasStore((s) => {
    if (kind !== "image" || !parentId) return false;
    const parentGroup = s.nodes.find((n) => n.id === parentId);
    return Boolean(parentGroup && isSbv1MediaGroup(parentGroup, s.nodes));
  });

  const lastFitKey = useRef("");

  useEffect(() => {
    const url = mediaUrl?.trim();
    if (!url || disabled || skipForSbv1GroupImage) return;

    const poster = posterUrl?.trim();
    const probeUrl = kind === "video" && poster ? poster : url;
    const probeKind: "image" | "video" =
      kind === "video" && poster ? "image" : kind;
    const fitKey = `${probeKind}|${probeUrl}|${profile}`;

    if (mediaFit && mediaFitKey === url) {
      lastFitKey.current = fitKey;
      return;
    }
    if (lastFitKey.current === fitKey) return;

    let cancelled = false;

    const cancelIdle = scheduleIdleWork(() => {
      void (async () => {
        try {
          const { w, h } = await probeLibtvMediaNaturalSize(probeUrl, probeKind);
          if (cancelled) return;
          const size = computeLibtvMediaNodeSize(w, h, profile);
          resizeNode(nodeId, size);
          updateNodeData(nodeId, {
            mediaFit: true,
            mediaFitKey: url,
          });
          lastFitKey.current = fitKey;

          const state = useCanvasStore.getState();
          const parentGroup = parentId
            ? state.nodes.find((n) => n.id === parentId)
            : undefined;
          if (
            parentId &&
            parentGroup &&
            isSbv1MediaGroup(parentGroup, state.nodes) &&
            profile === "sbv1-video"
          ) {
            relayoutSbv1MediaGroup(setNodes, parentId, edges);
          } else if (
            parentId &&
            parentGroup &&
            isPro2StyledGroup(parentGroup, state.nodes)
          ) {
            relayoutPro2MediaGroup(setNodes, parentId);
          }
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
    skipForSbv1GroupImage,
    parentId,
    mediaFit,
    mediaFitKey,
    edges,
    resizeNode,
    updateNodeData,
    setNodes,
  ]);
}

/** 组布局 / 工具条：是否已按媒体适配过尺寸 */
export function libtvNodeHasMediaFit(node: {
  data?: unknown;
}): boolean {
  return Boolean((node.data as { mediaFit?: boolean })?.mediaFit);
}
