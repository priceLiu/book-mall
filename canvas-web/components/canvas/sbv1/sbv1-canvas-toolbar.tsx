"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ImageIcon, ScanFace, Upload, Video } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { SBV1_DEFAULT_VIDEO_ENGINE_DATA } from "@/lib/canvas/sbv1-workspace-types";
import { SBV1_VIDEO_COMPOSE_LABEL } from "@/lib/canvas/sbv1-node-chrome";
import { selectSbv1NodeAfterSpawn } from "@/lib/canvas/sbv1-spawn-nodes";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";
import { spawnSbv1CanvasPastedImages } from "@/lib/canvas/spawn-sbv1-paste-images";
import { useSbv1PortraitLivenessStatus } from "@/lib/canvas/use-sbv1-portrait-liveness-status";
import { Sbv1PortraitLivenessModal } from "./sbv1-portrait-liveness-modal";
import { Sbv1Dock, type Sbv1DockItem } from "./sbv1-dock";

/** 分镜视频 1.0 · 底部 macOS 磁吸 dock */
export function Sbv1CanvasToolbar() {
  const base = useBookMallBaseUrl();
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [livenessOpen, setLivenessOpen] = useState(false);
  const { groupId, verifiedAt, refresh, isVerified } =
    useSbv1PortraitLivenessStatus(Boolean(base));

  const onAddImage = useCallback(() => {
    const pos = flowPositionAtViewportCenter("sbv1-image");
    const id = addNode("sbv1-image", pos ?? { x: 200, y: 200 }, { label: "图片" });
    if (id) selectSbv1NodeAfterSpawn(setNodes, id);
  }, [addNode, setNodes]);

  const onAddVideoEngine = useCallback(() => {
    const pos = flowPositionAtViewportCenter("sbv1-video-engine");
    const id = addNode(
      "sbv1-video-engine",
      pos ?? { x: 280, y: 160 },
      { ...SBV1_DEFAULT_VIDEO_ENGINE_DATA },
    );
    if (id) selectSbv1NodeAfterSpawn(setNodes, id);
  }, [addNode, setNodes]);

  const onPickFiles = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !base) return;
      const pos = flowPositionAtViewportCenter("sbv1-image") ?? { x: 200, y: 200 };
      await spawnSbv1CanvasPastedImages({
        files: Array.from(files),
        base,
        origin: pos,
        addNode,
        updateNodeData,
      });
    },
    [base, addNode, updateNodeData],
  );

  const onOpenLiveness = useCallback(() => {
    if (!base) return;
    setLivenessOpen(true);
  }, [base]);

  const dockItems = useMemo<Sbv1DockItem[]>(
    () => [
      {
        id: "image",
        name: "添加图片",
        icon: <ImageIcon strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-sky-400 to-blue-600",
        onClick: onAddImage,
      },
      {
        id: "upload",
        name: "上传图片",
        icon: <Upload strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-emerald-400 to-green-600",
        onClick: onPickFiles,
        disabled: !base,
      },
      {
        id: "video-compose",
        name: SBV1_VIDEO_COMPOSE_LABEL,
        icon: <Video strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-rose-400 to-red-600",
        onClick: onAddVideoEngine,
      },
      {
        id: "liveness",
        name: isVerified ? "真人人像 · 已认证" : "真人人像 · 活体",
        icon: <ScanFace strokeWidth={1.75} />,
        color: isVerified
          ? "bg-gradient-to-br from-teal-400 to-emerald-600"
          : "bg-gradient-to-br from-cyan-400 to-teal-600",
        onClick: onOpenLiveness,
        disabled: !base,
      },
    ],
    [onAddImage, onPickFiles, onAddVideoEngine, onOpenLiveness, base, isVerified],
  );

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-[70] flex justify-center px-4">
        <Sbv1Dock items={dockItems} />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Sbv1PortraitLivenessModal
        open={livenessOpen}
        existingGroupId={groupId}
        verifiedAt={verifiedAt}
        onClose={() => setLivenessOpen(false)}
        onSuccess={() => {
          void refresh();
        }}
      />
    </>
  );
}
