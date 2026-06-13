"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ImageIcon, ScanFace, Upload, Video } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { SBV1_DEFAULT_VIDEO_ENGINE_DATA } from "@/lib/canvas/sbv1-workspace-types";
import { SBV1_VIDEO_COMPOSE_LABEL } from "@/lib/canvas/sbv1-node-chrome";
import { selectSbv1NodeAfterSpawn } from "@/lib/canvas/sbv1-spawn-nodes";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";
import { spawnSbv1CanvasPastedImages } from "@/lib/canvas/spawn-sbv1-paste-images";
import { Sbv1PortraitLivenessModal } from "./sbv1-portrait-liveness-modal";
import { Sbv1Dock, type Sbv1DockItem } from "./sbv1-dock";

/** 分镜视频 1.0 · 底部 macOS 磁吸 dock */
export function Sbv1CanvasToolbar() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodes = useCanvasStore((s) => s.nodes);
  const fileRef = useRef<HTMLInputElement>(null);
  const [livenessOpen, setLivenessOpen] = useState(false);
  const [livenessEngineId, setLivenessEngineId] = useState<string | null>(null);

  const livenessEngine = useMemo(() => {
    const selected = nodes.filter(
      (n) => n.selected && n.type === "sbv1-video-engine",
    );
    if (selected.length === 1) return selected[0]!;
    const engines = nodes.filter((n) => n.type === "sbv1-video-engine");
    if (engines.length === 1) return engines[0]!;
    if (livenessEngineId) {
      return nodes.find((n) => n.id === livenessEngineId) ?? null;
    }
    return null;
  }, [nodes, livenessEngineId]);

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

  const onOpenLiveness = useCallback(async () => {
    let engine = livenessEngine;
    if (!engine) {
      const engines = nodes.filter((n) => n.type === "sbv1-video-engine");
      if (engines.length === 0) {
        const pos = flowPositionAtViewportCenter("sbv1-video-engine");
        const id = addNode(
          "sbv1-video-engine",
          pos ?? { x: 280, y: 160 },
          { ...SBV1_DEFAULT_VIDEO_ENGINE_DATA },
        );
        if (id) {
          selectSbv1NodeAfterSpawn(setNodes, id);
          setLivenessEngineId(id);
          setLivenessOpen(true);
          return;
        }
      } else if (engines.length > 1) {
        await alert({
          title: `请选择${SBV1_VIDEO_COMPOSE_LABEL}`,
          message: `画布上有多个${SBV1_VIDEO_COMPOSE_LABEL}节点，请先选中要绑定 GroupId 的那一个，再点活体认证。`,
          variant: "warning",
        });
        return;
      } else {
        engine = engines[0]!;
      }
    }
    if (!engine) {
      await alert({
        title: "无法打开活体认证",
        message: `请先添加${SBV1_VIDEO_COMPOSE_LABEL}节点。`,
        variant: "warning",
      });
      return;
    }
    setLivenessEngineId(engine.id);
    selectSbv1NodeAfterSpawn(setNodes, engine.id);
    setLivenessOpen(true);
  }, [livenessEngine, nodes, addNode, setNodes, alert]);

  const existingGroupId = livenessEngine
    ? String(
        (livenessEngine.data as { realPersonGroupId?: string })
          .realPersonGroupId ?? "",
      ).trim() || undefined
    : undefined;

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
        name: "真人人像 · 活体",
        icon: <ScanFace strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-cyan-400 to-teal-600",
        onClick: () => void onOpenLiveness(),
        disabled: !base,
      },
    ],
    [onAddImage, onPickFiles, onAddVideoEngine, onOpenLiveness, base],
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
        existingGroupId={existingGroupId}
        onClose={() => setLivenessOpen(false)}
        onSuccess={(groupId) => {
          const targetId = livenessEngineId ?? livenessEngine?.id;
          if (!targetId) return;
          updateNodeData(targetId, {
            realPersonGroupId: groupId,
            realPersonLivenessAt: new Date().toISOString(),
          });
        }}
      />
    </>
  );
}
