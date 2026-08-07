"use client";

import { useCallback } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { cancelMediaRenderJob } from "@/lib/canvas-api";
import {
  MEDIA_RENDER_CANCEL_CONFIRM_MESSAGE,
  MEDIA_RENDER_CANCEL_CONFIRM_TITLE,
} from "@/lib/canvas/canvas-generation-cancel-messages";
import { dismissMediaRenderPoll } from "@/lib/canvas/media-render-in-flight";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingMediaRenderInFlight } from "@/lib/canvas/media-render-in-flight";

/** 云端自动剪辑 · 用户中止（须 confirm 扣费提示） */
export function useMediaRenderCancel(nodeId: string) {
  const base = useBookMallBaseUrl();
  const dialogs = useDialogs();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const requestCancel = useCallback(async () => {
    if (
      !(await dialogs.confirm({
        title: MEDIA_RENDER_CANCEL_CONFIRM_TITLE,
        message: MEDIA_RENDER_CANCEL_CONFIRM_MESSAGE,
      }))
    ) {
      return;
    }

    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    const inFlight = (node?.data as {
      mediaRenderInFlight?: JianyingMediaRenderInFlight | null;
    })?.mediaRenderInFlight;
    const jobId = inFlight?.jobId?.trim();
    if (jobId && jobId !== "pending" && base?.trim()) {
      try {
        await cancelMediaRenderJob(base, jobId);
      } catch {
        /* 本地仍停止等待 */
      }
    }
    if (jobId) dismissMediaRenderPoll(nodeId, jobId);
    updateNodeData(nodeId, { mediaRenderInFlight: null });
    window.dispatchEvent(
      new CustomEvent("canvas:media-render-cancelled", {
        detail: { nodeId, jobId },
      }),
    );
  }, [base, dialogs, nodeId, updateNodeData]);

  return { requestCancel };
}
