"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { getDirectorWebOrigin } from "@/lib/canvas/director-web-origin";
import { useCanvasStore } from "@/lib/canvas/store";
import { resolveUpstreamImageUrls } from "@/lib/canvas/upstream-images";
import type { StoryPro23dDeskNodeData } from "@/lib/canvas/types";

type HostCapture = { dataUrl?: unknown; fileName?: unknown };

function dataUrlToFile(dataUrl: string, fileName: string): File | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return null;
  const head = dataUrl.slice(5, comma);
  const mime = head.split(";")[0] || "image/png";
  const isBase64 = /;base64/i.test(head);
  const body = dataUrl.slice(comma + 1);
  try {
    const bin = isBase64 ? atob(body) : decodeURIComponent(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
    return new File([arr], fileName, { type: mime });
  } catch {
    return null;
  }
}

/** 全局挂载 · 3D导演台节点全屏编辑（iframe 内嵌 director-web，postMessage 桥接截图） */
export function Director3dDeskEditorHost() {
  const editorNodeId = useCanvasStore((s) => s.director3dDeskEditorNodeId);
  const closeEditor = useCanvasStore((s) => s.closeDirector3dDeskEditor);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const base = useBookMallBaseUrl();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
    async (captures: HostCapture[]) => {
      const first = captures.find(
        (c) => typeof c.dataUrl === "string" && (c.dataUrl as string).trim(),
      );
      if (!first || !editorNodeId) return;
      const dataUrl = (first.dataUrl as string).trim();
      const fileName =
        (typeof first.fileName === "string" && first.fileName.trim()) ||
        "director-desk-capture.png";
      const file = dataUrlToFile(dataUrl, fileName);
      if (!file) return;

      updateNodeData(editorNodeId, {
        blobUrl: dataUrl,
        uploading: true,
        uploadError: undefined,
        runtime: { status: "pending" },
      });
      try {
        const ossUrl = await uploadCanvasImage(base, file);
        updateNodeData(editorNodeId, {
          ossUrl,
          thumbUrl: ossUrl,
          blobUrl: undefined,
          uploading: false,
          runtime: { status: "done", ossUrl },
        });
      } catch (e) {
        updateNodeData(editorNodeId, {
          uploading: false,
          uploadError: e instanceof Error ? e.message : String(e),
          runtime: {
            status: "error",
            failMessage: e instanceof Error ? e.message : String(e),
          },
        });
      }
    },
    [base, editorNodeId, updateNodeData],
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
    </div>,
    document.body,
  );
}
