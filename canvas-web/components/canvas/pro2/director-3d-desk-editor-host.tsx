"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { publishDirectorDeskCapturesToCanvas } from "@/lib/canvas/director-desk-spawn-shot";
import { getDirectorWebOrigin } from "@/lib/canvas/director-web-origin";
import { useCanvasStore } from "@/lib/canvas/store";
import { resolveUpstreamImageUrls } from "@/lib/canvas/upstream-images";
import type { StoryPro23dDeskNodeData } from "@/lib/canvas/types";

type HostCapture = { dataUrl?: unknown; fileName?: unknown };

/** 全局挂载 · 3D导演台节点全屏编辑（iframe 内嵌 director-web，postMessage 桥接截图） */
export function Director3dDeskEditorHost() {
  const editorNodeId = useCanvasStore((s) => s.director3dDeskEditorNodeId);
  const closeEditor = useCanvasStore((s) => s.closeDirector3dDeskEditor);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const base = useBookMallBaseUrl();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [sendToast, setSendToast] = useState<string | null>(null);
  const sendToastTimerRef = useRef<number | null>(null);
  useEffect(() => setMounted(true), []);

  const showSendSuccessToast = useCallback((message = "发送成功") => {
    setSendToast(message);
    if (sendToastTimerRef.current !== null) {
      window.clearTimeout(sendToastTimerRef.current);
    }
    sendToastTimerRef.current = window.setTimeout(() => {
      setSendToast(null);
      sendToastTimerRef.current = null;
    }, 2800);
  }, []);

  useEffect(
    () => () => {
      if (sendToastTimerRef.current !== null) {
        window.clearTimeout(sendToastTimerRef.current);
      }
    },
    [],
  );

  const directorOrigin = useMemo(() => getDirectorWebOrigin(), []);

  const node = useMemo(
    () =>
      editorNodeId
        ? nodes.find(
            (n) => n.id === editorNodeId && n.type === "story-pro2-3d-desk",
          )
        : undefined,
    [editorNodeId, nodes],
  );

  const nodeData = node?.data as unknown as StoryPro23dDeskNodeData | undefined;
  const instanceId = nodeData?.sceneInstanceId ?? editorNodeId ?? "";

  const panoramaUrl = useMemo(() => {
    if (!editorNodeId) return null;
    const urls = resolveUpstreamImageUrls(nodes, edges, editorNodeId);
    return urls[0] ?? null;
  }, [editorNodeId, nodes, edges]);

  const iframeSrc = useMemo(() => {
    if (!editorNodeId || typeof window === "undefined") return "";
    const q = new URLSearchParams({
      embed: "1",
      hostOrigin: window.location.origin,
      instanceId,
      theme: "dark",
    });
    return `${directorOrigin}/?${q.toString()}`;
  }, [directorOrigin, editorNodeId, instanceId]);

  const onCaptures = useCallback(
    (captures: HostCapture[]) => {
      if (!editorNodeId) return;
      const normalized = captures
        .map((c) => ({
          dataUrl: typeof c.dataUrl === "string" ? c.dataUrl.trim() : "",
          fileName:
            (typeof c.fileName === "string" && c.fileName.trim()) ||
            "机位-shot.png",
        }))
        .filter((c) => c.dataUrl);
      if (normalized.length === 0) return;

      const created = publishDirectorDeskCapturesToCanvas({
        deskNodeId: editorNodeId,
        captures: normalized,
        upload: (file) => uploadCanvasImage(base, file),
      });
      if (created.length === 0) return;

      showSendSuccessToast("发送成功");

      const win = iframeRef.current?.contentWindow;
      win?.postMessage(
        {
          type: "storyai:director-desk-captures-ack",
          payload: { ok: true, count: created.length },
        },
        directorOrigin,
      );
    },
    [base, editorNodeId, directorOrigin, showSendSuccessToast],
  );

  useEffect(() => {
    if (!editorNodeId) return;
    function handleMessage(event: MessageEvent) {
      if (event.origin !== directorOrigin) return;
      const type = (event.data as { type?: unknown } | null)?.type;
      const win = iframeRef.current?.contentWindow;
      if (type === "storyai:director-desk-ready") {
        win?.postMessage(
          {
            type: "storyai:director-desk-session",
            payload: { instanceId, theme: "dark" },
          },
          directorOrigin,
        );
        if (panoramaUrl) {
          win?.postMessage(
            {
              type: "storyai:director-desk-panorama",
              payload: {
                sourceNodeId: editorNodeId,
                imageUrl: panoramaUrl,
                fileName: "上游参考图.png",
              },
            },
            directorOrigin,
          );
        }
        return;
      }
      if (type === "storyai:director-desk-captures-sent") {
        const payload = (event.data as { payload?: { captures?: HostCapture[] } })
          .payload;
        void onCaptures(payload?.captures ?? []);
        return;
      }
      if (type === "storyai:director-desk-close") {
        closeEditor();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    editorNodeId,
    directorOrigin,
    instanceId,
    panoramaUrl,
    onCaptures,
    closeEditor,
  ]);

  useEffect(() => {
    if (!editorNodeId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeEditor();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editorNodeId, closeEditor]);

  if (!mounted || !editorNodeId || !node) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#090909]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/60 px-4 py-2 text-white">
        <span className="text-sm font-medium">3D导演台</span>
        <button
          type="button"
          onClick={closeEditor}
          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10"
          aria-label="关闭"
        >
          <X className="size-4" />
          关闭
        </button>
      </div>
      {iframeSrc ? (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="3D导演台"
          className="min-h-0 w-full flex-1 border-0"
          allow="fullscreen"
        />
      ) : null}
      {sendToast ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[10050] flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-xl border border-violet-400/35 bg-[#1a1a1a]/97 px-4 py-2.5 text-sm text-violet-50 shadow-lg">
            <span>{sendToast}</span>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
