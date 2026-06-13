"use client";

import { useCallback, useState, type DragEvent, type ReactNode } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  allImageFilesFromDataTransfer,
  useImagePasteWhenActive,
} from "@/lib/canvas/image-upload-handlers";
import { spawnPro2DockPastedImages } from "@/lib/canvas/spawn-pro2-dock-paste-images";
import { spawnSbv1ImageDockPastedImages } from "@/lib/canvas/spawn-sbv1-paste-images";
import { useCanvasStore } from "@/lib/canvas/store";
import { cn } from "@/lib/utils";

export type Pro2DockPasteZoneProps = {
  anchorNodeId: string;
  anchorNodeType: string;
  disabled?: boolean;
  maxImages?: number;
  children: ReactNode;
};

/**
 * 输入坞粘贴区：多图 Ctrl+V / 拖入松手；在锚点节点左侧生成图片节点并连线。
 */
export function Pro2DockPasteZone({
  anchorNodeId,
  anchorNodeType,
  disabled,
  maxImages = 12,
  children,
}: Pro2DockPasteZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const base = useBookMallBaseUrl();
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const ingestFiles = useCallback(
    async (files: File[]) => {
      if (disabled || !base || !files.length) return;
      const state = useCanvasStore.getState();
      if (anchorNodeType === "sbv1-image") {
        await spawnSbv1ImageDockPastedImages({
          anchorNodeId,
          files,
          base,
          nodes: state.nodes,
          edges: state.edges,
          addNode,
          setEdges,
          updateNodeData,
          setNodes,
          maxCount: maxImages,
        });
        return;
      }
      await spawnPro2DockPastedImages({
        anchorNodeId,
        anchorNodeType,
        files,
        base,
        nodes: state.nodes,
        edges: state.edges,
        addNode,
        setEdges,
        updateNodeData,
        setNodes,
        maxCount: maxImages,
      });
    },
    [
      anchorNodeId,
      anchorNodeType,
      base,
      disabled,
      addNode,
      setEdges,
      setNodes,
      updateNodeData,
      maxImages,
    ],
  );

  /** 坞可见即注册；实际落点由指针是否在 .pro2-dock-paste-zone 判定 */
  useImagePasteWhenActive(
    !disabled,
    { onFiles: (files) => void ingestFiles(files) },
    true,
    `pro2-dock-paste-${anchorNodeId}`,
    "zone",
  );

  const onDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (!allImageFilesFromDataTransfer(e.dataTransfer).length) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    },
    [disabled],
  );

  const onDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (!allImageFilesFromDataTransfer(e.dataTransfer).length) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    const rel = e.relatedTarget as Node | null;
    if (rel && e.currentTarget.contains(rel)) return;
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = allImageFilesFromDataTransfer(e.dataTransfer);
      if (files.length) void ingestFiles(files);
    },
    [disabled, ingestFiles],
  );

  return (
    <div
      className={cn(
        "pro2-dock-paste-zone transition-[box-shadow,outline-color] duration-150",
        dragOver &&
          "rounded-2xl outline outline-2 outline-offset-0 outline-violet-400/55 ring-4 ring-violet-500/15",
      )}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}
