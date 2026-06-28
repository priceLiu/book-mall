"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  FileText,
  ImageIcon,
  Play,
  Plus,
  Upload,
  Video,
} from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { handlePro2ToolbarAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import { PRO2_TOOLBAR_ADD_MENU } from "@/lib/canvas/pro2-add-node-menu";
import {
  spawnPro2ShortcutPreset,
  type Pro2ShortcutPresetId,
} from "@/lib/canvas/pro2-spawn-shortcut-presets";
import { spawnPro2CanvasPastedImages } from "@/lib/canvas/spawn-pro2-dock-paste-images";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";
import type { CanvasNodeType } from "@/lib/canvas/types";
import { LibtvCanvasDockBarSlot } from "@/components/canvas/libtv-canvas-dock-bar-slot";
import { Sbv1Dock, type Sbv1DockItem } from "@/components/canvas/sbv1/sbv1-dock";
import { Pro2AddNodePopover } from "./pro2-add-node-popover";
import { useDialogs } from "@/components/dialogs/dialog-provider";

export type Pro2CanvasToolbarProps = {
  projectId: string;
  onOpenStyleLibrary?: () => void;
  onOpenMyHistory?: () => void;
};

/** 2.0 画布底部 Dock · 与分镜 1.0 同款四色磁吸图标；功能保持 Pro2 菜单/快捷添加 */
export function Pro2CanvasToolbar({
  projectId,
  onOpenStyleLibrary,
  onOpenMyHistory,
}: Pro2CanvasToolbarProps) {
  const base = useBookMallBaseUrl();
  const { alert, confirm } = useDialogs();
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const createGroupContaining = useCanvasStore((s) => s.createGroupContaining);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const dockBarRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const anchorMenuAboveDock = useCallback(() => {
    const rect = dockBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }, []);

  const onToggleMenu = useCallback(() => {
    setMenuOpen((open) => {
      if (open) return false;
      anchorMenuAboveDock();
      return true;
    });
  }, [anchorMenuAboveDock]);

  const onPick = useCallback(
    async (itemId: string, nodeType?: string) => {
      setMenuOpen(false);
      await handlePro2ToolbarAddNodePick(
        itemId,
        nodeType,
        { addNode, setNodes },
        { alert, confirm },
        { onOpenStyleLibrary, onOpenMyHistory },
      );
    },
    [addNode, setNodes, alert, confirm, onOpenStyleLibrary, onOpenMyHistory],
  );

  const onQuickImage = useCallback(() => {
    void onPick("image", "story-pro2-image");
  }, [onPick]);

  const onQuickScript = useCallback(() => {
    void onPick("script", "story-pro2-script-hub");
  }, [onPick]);

  const onPickFiles = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !base) return;
      const pos = flowPositionAtViewportCenter("story-pro2-image") ?? {
        x: 200,
        y: 200,
      };
      await spawnPro2CanvasPastedImages({
        files: Array.from(files),
        base,
        origin: pos,
        addNode,
        updateNodeData,
        setNodes,
      });
    },
    [base, addNode, updateNodeData, setNodes],
  );

  const onShortcutPreset = useCallback(
    (preset: Pro2ShortcutPresetId) => {
      spawnPro2ShortcutPreset(preset, {
        addNode: (type, position, data) =>
          addNode(type as CanvasNodeType, position, data),
        setEdges,
        setNodes,
        createGroupContaining: (childIds, opts) =>
          createGroupContaining(childIds, {
            label: opts?.label ?? "",
            color: "",
            pro2Styled: opts?.pro2Styled,
            pro2ShortcutPreset: opts?.pro2ShortcutPreset,
          }),
      });
    },
    [addNode, setEdges, setNodes, createGroupContaining],
  );

  const dockItems = useMemo<Sbv1DockItem[]>(
    () => [
      {
        id: "image-to-prompt",
        name: "图片反推提示词",
        icon: <ImageIcon strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-violet-400 to-purple-600",
        onClick: () => onShortcutPreset("image-to-prompt"),
      },
      {
        id: "video-to-prompt",
        name: "视频反推提示词",
        icon: <Video strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-amber-400 to-orange-600",
        onClick: () => onShortcutPreset("video-to-prompt"),
      },
      {
        id: "text-to-video",
        name: "文生视频",
        icon: <Play strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-fuchsia-400 to-pink-600",
        onClick: () => onShortcutPreset("text-to-video"),
      },
      {
        id: "image",
        name: "添加图片",
        icon: <ImageIcon strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-sky-400 to-blue-600",
        onClick: onQuickImage,
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
        id: "script",
        name: "脚本生成器",
        icon: <FileText strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-rose-400 to-red-600",
        onClick: onQuickScript,
      },
      {
        id: "add-nodes",
        name: menuOpen ? "关闭菜单" : "更多节点",
        icon: <Plus strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-cyan-400 to-teal-600",
        onClick: onToggleMenu,
      },
    ],
    [menuOpen, onToggleMenu, onQuickImage, onPickFiles, onQuickScript, onShortcutPreset, base],
  );

  return (
    <>
      <LibtvCanvasDockBarSlot storageKey={`pro2:${projectId}`} dockRef={dockBarRef}>
        <Sbv1Dock items={dockItems} />
      </LibtvCanvasDockBarSlot>
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
      <Pro2AddNodePopover
        open={menuOpen}
        anchor={anchor}
        placement="above-center"
        sections={PRO2_TOOLBAR_ADD_MENU}
        onClose={() => setMenuOpen(false)}
        onPick={onPick}
      />
    </>
  );
}
