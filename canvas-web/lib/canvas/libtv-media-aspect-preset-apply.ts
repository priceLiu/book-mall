"use client";

import { useEffect } from "react";
import { LIBTV_MEDIA_FIT_VERSION, LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION } from "./libtv-node-chrome";
import { expandLibtvGroupToFitChildren } from "./libtv-group-content-bounds";
import {
  computeLibtvMediaAspectPresetSize,
  LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES,
  parseAspectRatioToNumbers,
  readNodeAspectRatio,
  readAspectPresetProfileFromFitKey,
  resolveEffectiveAspectRatioForPreset,
  resolveLibtvMediaAspectPresetProfile,
  shouldSkipLibtvMediaAspectPresetForNaturalMedia,
} from "./libtv-media-aspect-preset";
import { isPro2StyledGroup } from "./pro2-media-group-meta";
import { relayoutPro2MediaGroup } from "./pro2-media-group-layout";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import {
  shouldUseSbv1ImageVideoColumnLayout,
  scheduleRelayoutSbv1MediaGroup,
} from "./sbv1-media-group-layout";
import {
  computeLibtvMediaNodeSize,
  loadImageNaturalSize,
  resolveLibtvMediaNodeBoxSize,
} from "./libtv-media-node-auto-fit";
import { useCanvasStore } from "./store";

export {
  computeLibtvMediaAspectPresetSize,
  libtvNodeUsesAspectPreset,
  parseAspectRatioToNumbers,
  readNodeAspectRatio,
  readAspectPresetProfileFromFitKey,
  resolveEffectiveAspectRatioForPreset,
  resolveLibtvMediaAspectPresetProfile,
  shouldSkipLibtvMediaAspectPresetForNaturalMedia,
} from "./libtv-media-aspect-preset";
export type { LibtvMediaAspectPresetProfile } from "./libtv-media-aspect-preset";

function relayoutParentGroupIfNeeded(nodeId: string, parentId?: string): void {
  if (!parentId) return;
  const state = useCanvasStore.getState();
  const parentGroup = state.nodes.find((n) => n.id === parentId);
  if (!parentGroup) return;

  const setNodes = state.setNodes;
  const mixedVideoGroup =
    shouldUseSbv1ImageVideoColumnLayout(parentGroup, state.nodes) ||
    isSbv1MediaGroup(parentGroup, state.nodes);

  // 图/视频混组：比例同步后强制统一外框（忽略历史 manualSize，否则图永远对不齐视频）
  // 防抖合并：多节点同时 sync 时只 relayout 一次，避免 Maximum update depth
  if (mixedVideoGroup) {
    scheduleRelayoutSbv1MediaGroup(
      setNodes,
      parentId,
      () => useCanvasStore.getState().edges,
      120,
      { force: true, mode: "auto" },
    );
    return;
  }

  const parentManualSize = Boolean(
    (parentGroup.data as { manualSize?: boolean } | undefined)?.manualSize,
  );
  if (parentManualSize) return;

  if (isPro2StyledGroup(parentGroup, state.nodes)) {
    relayoutPro2MediaGroup(setNodes, parentId);
    setNodes((nodes) => expandLibtvGroupToFitChildren(nodes, parentId));
  }
}

/** 按节点 data.aspectRatio 立即调整外框；写入 mediaAspectPreset 后生成完成不再 auto-fit */
export function applyLibtvMediaAspectPreset(nodeId: string): void {
  const state = useCanvasStore.getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node?.type || !LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES.has(node.type)) {
    return;
  }
  if (shouldSkipLibtvMediaAspectPresetForNaturalMedia(node)) {
    return;
  }

  const profile = resolveLibtvMediaAspectPresetProfile(node, state.nodes);
  if (!profile) return;

  const effectiveRatio = resolveEffectiveAspectRatioForPreset(
    readNodeAspectRatio(node),
    profile,
  );
  const size = resolveLibtvMediaNodeBoxSize(node, state.nodes);
  const nodeW = Math.round(
    (typeof node.width === "number" ? node.width : undefined) ??
      (node.style as { width?: number } | undefined)?.width ??
      0,
  );
  const nodeH = Math.round(
    (typeof node.height === "number" ? node.height : undefined) ??
      (node.style as { height?: number } | undefined)?.height ??
      0,
  );
  const d = node.data as {
    mediaAspectPreset?: string;
    mediaAspectPresetSizeVersion?: number;
    mediaFitKey?: string;
  };
  const fitKeyProfile = readAspectPresetProfileFromFitKey(d.mediaFitKey);
  if (
    d.mediaAspectPreset === effectiveRatio &&
    d.mediaAspectPresetSizeVersion === LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION &&
    nodeW === size.width &&
    nodeH === size.height &&
    (!fitKeyProfile || fitKeyProfile === profile)
  ) {
    return;
  }

  const { w, h } = parseAspectRatioToNumbers(effectiveRatio);

  state.applyLibtvMediaFit(nodeId, size, {
    mediaAspectPreset: effectiveRatio,
    mediaAspectPresetSizeVersion: LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION,
    mediaFit: true,
    mediaFitKey: `aspect-preset|${effectiveRatio}|${profile}`,
    mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
    mediaNaturalW: w * 100,
    mediaNaturalH: h * 100,
    manualSize: false,
  });

  relayoutParentGroupIfNeeded(nodeId, node.parentId);
}

export function maybeApplyLibtvMediaAspectPresetFromPatch(
  nodeId: string,
  patch: Record<string, unknown>,
): void {
  if ("blobUrl" in patch && String(patch.blobUrl ?? "").trim()) {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (node && shouldSkipLibtvMediaAspectPresetForNaturalMedia(node)) {
      const fitKey = (node.data as { mediaFitKey?: string }).mediaFitKey;
      if (!fitKey?.startsWith("upload|")) {
        queueMicrotask(() => {
          fitLibtvUploadedImageNaturalSize(
            nodeId,
            String(patch.blobUrl),
          );
        });
      }
    }
  }
  if (!("aspectRatio" in patch)) return;
  queueMicrotask(() => applyLibtvMediaAspectPreset(nodeId));
}

/** 粘贴/上传 blob 后按 natural 尺寸调整外框（跳固定 1:1 preset） */
export function fitLibtvUploadedImageNaturalSize(
  nodeId: string,
  mediaUrl: string,
): void {
  const url = mediaUrl.trim();
  if (!url) return;
  void loadImageNaturalSize(url)
    .then(({ w, h }) => {
      const state = useCanvasStore.getState();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node?.type || !LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES.has(node.type)) {
        return;
      }
      if (!shouldSkipLibtvMediaAspectPresetForNaturalMedia(node)) {
        return;
      }
      const size = computeLibtvMediaNodeSize(w, h, "sbv1-media");
      state.applyLibtvMediaFit(nodeId, size, {
        mediaAspectPreset: "",
        mediaFit: true,
        mediaFitKey: `upload|${url}|sbv1-media`,
        mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
        mediaNaturalW: w,
        mediaNaturalH: h,
        manualSize: false,
      });
    })
    .catch(() => {
      /* 探测失败时保留当前尺寸 */
    });
}

/** 经典 image 节点 · 粘贴/上传后按 natural 比例调整外框 */
export function fitGenericImageNodeNaturalSize(
  nodeId: string,
  mediaUrl: string,
): void {
  const url = mediaUrl.trim();
  if (!url) return;
  void loadImageNaturalSize(url)
    .then(({ w, h }) => {
      const longEdge = 380;
      const scale = longEdge / Math.max(w, h);
      const stageW = Math.max(280, Math.ceil(w * scale));
      const stageH = Math.max(168, Math.ceil(h * scale));
      const size = { width: stageW, height: stageH + 96 };
      useCanvasStore.getState().applyLibtvMediaFit(nodeId, size, {
        mediaFit: true,
        mediaFitKey: `upload|${url}|generic-image`,
        mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
        mediaNaturalW: w,
        mediaNaturalH: h,
        manualSize: false,
      });
    })
    .catch(() => {});
}

export function maybeApplyLibtvMediaAspectPresetForNewNode(
  nodeId: string,
  type: string,
): void {
  if (!LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES.has(type)) return;
  queueMicrotask(() => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (node && shouldSkipLibtvMediaAspectPresetForNaturalMedia(node)) {
      const url = String(
        (node.data as { blobUrl?: string }).blobUrl ?? "",
      ).trim();
      if (url) fitLibtvUploadedImageNaturalSize(nodeId, url);
      return;
    }
    applyLibtvMediaAspectPreset(nodeId);
  });
}

/** 旧画布 / 首次挂载：aspectRatio 或 2× 外框迁移未完成时补一次外框 */
export function useLibtvMediaAspectPresetSync(
  nodeId: string,
  aspectRatio: string | undefined,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled || !nodeId) return;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (!node?.type || !LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES.has(node.type)) {
      return;
    }

    const data = node.data as {
      mediaAspectPreset?: string;
      mediaAspectPresetSizeVersion?: number;
      mediaFitKey?: string;
      blobUrl?: string;
    };

    if (shouldSkipLibtvMediaAspectPresetForNaturalMedia(node)) {
      const url = String(data.blobUrl ?? "").trim();
      const mediaFit = (node.data as { mediaFit?: boolean }).mediaFit;
      if (url && !mediaFit) {
        fitLibtvUploadedImageNaturalSize(nodeId, url);
      }
      return;
    }

    const profile = resolveLibtvMediaAspectPresetProfile(
      node,
      useCanvasStore.getState().nodes,
    );
    if (!profile) return;

    const effectiveRatio = resolveEffectiveAspectRatioForPreset(
      readNodeAspectRatio(node),
      profile,
    );
    const expected = resolveLibtvMediaNodeBoxSize(node, useCanvasStore.getState().nodes);
    const nodeW = Math.round(
      (typeof node.width === "number" ? node.width : undefined) ??
        (node.style as { width?: number } | undefined)?.width ??
        0,
    );
    const nodeH = Math.round(
      (typeof node.height === "number" ? node.height : undefined) ??
        (node.style as { height?: number } | undefined)?.height ??
        0,
    );

    const fitKeyProfile = readAspectPresetProfileFromFitKey(data.mediaFitKey);
    const presetOk =
      data.mediaAspectPreset === effectiveRatio &&
      data.mediaAspectPresetSizeVersion ===
        LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION &&
      nodeW === expected.width &&
      nodeH === expected.height &&
      (!fitKeyProfile || fitKeyProfile === profile);

    if (presetOk) return;

    applyLibtvMediaAspectPreset(nodeId);
  }, [nodeId, aspectRatio, enabled]);
}
