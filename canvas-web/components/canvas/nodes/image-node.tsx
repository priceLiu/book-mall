"use client";

import { useCallback, useRef } from "react";
import type { NodeProps } from "@xyflow/react";
import { ImageIcon, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { useCanvasStore } from "@/lib/canvas/store";
import type { ImageNodeData } from "@/lib/canvas/types";
import { MediaHoverBox } from "../media-hover-box";
import { NodeShell } from "../node-shell";
import {
  NODE_MEDIA_MIN_WIDTH,
  NODE_MEDIA_UPLOAD_HEIGHT,
  NodeMediaStage,
} from "../node-ui";

export function ImageNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const d = data as unknown as ImageNodeData;

  const onPick = useCallback(() => inputRef.current?.click(), []);

  const onFile = useCallback(
    async (file: File) => {
      if (!file) return;
      const blobUrl = URL.createObjectURL(file);
      updateNodeData(id, {
        blobUrl,
        ossUrl: undefined,
        uploading: true,
        uploadError: undefined,
        label: file.name,
      });
      try {
        const ossUrl = await uploadCanvasImage(base, file);
        updateNodeData(id, { ossUrl, uploading: false });
      } catch (e) {
        updateNodeData(id, {
          uploading: false,
          uploadError: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [base, id, updateNodeData],
  );

  const previewUrl = d.ossUrl ?? d.blobUrl ?? "";

  return (
    <NodeShell
      title="图片"
      subtitle={d.label ?? "本地上传 / 拖入"}
      selected={selected}
      runtime={d.runtime}
      minWidth={NODE_MEDIA_MIN_WIDTH}
      minHeight={NODE_MEDIA_UPLOAD_HEIGHT}
      outputs={[{ id: "image", label: "图片", kind: "image" }]}
    >
      <div className="flex h-full flex-col gap-2">
        <NodeMediaStage>
          <MediaHoverBox
            src={previewUrl || undefined}
            variant="uploadable"
            onUpload={onPick}
            clickToPreview
            alt={d.label ?? "image"}
            fit="contain"
            placeholder={
              <div className="flex h-full items-center justify-center text-[var(--canvas-muted)]">
                <ImageIcon className="size-6 opacity-50" />
              </div>
            }
          />
        </NodeMediaStage>
        <div className="flex items-center justify-end gap-2">
          {d.uploading ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-200">
              <Loader2 className="size-3 animate-spin" /> 上传中…
            </span>
          ) : d.uploadError ? (
            <span className="text-[10px] text-red-300">{d.uploadError}</span>
          ) : d.ossUrl ? (
            <span className="text-[10px] text-emerald-300">已上传</span>
          ) : d.blobUrl ? (
            <span className="text-[10px] text-amber-200">仅本地（未上传）</span>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </NodeShell>
  );
}
