"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  FileText,
  ImageIcon,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { handlePro2ToolbarAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import { PRO2_TOOLBAR_ADD_MENU } from "@/lib/canvas/pro2-add-node-menu";
import { spawnPro2CanvasPastedImages } from "@/lib/canvas/spawn-pro2-dock-paste-images";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";
import { Sbv1Dock, type Sbv1DockItem } from "@/components/canvas/sbv1/sbv1-dock";
import { Pro2AddNodePopover } from "./pro2-add-node-popover";
import { useDialogs } from "@/components/dialogs/dialog-provider";

export type Pro2CanvasToolbarProps = {
  onOpenStyleLibrary?: () => void;
};

/** 2.0 画布底部 Dock · 与分镜 1.0 同款四色磁吸图标；功能保持 Pro2 菜单/快捷添加 */
export function Pro2CanvasToolbar({
  onOpenStyleLibrary,
}: Pro2CanvasToolbarProps) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const onToggleMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.left + rect.width / 2 - 100, y: rect.top - 8 });
    setMenuOpen((v) => !v);
  }, []);

  const onPick = useCallback(
    async (itemId: string, nodeType?: string) => {
      setMenuOpen(false);
      await handlePro2ToolbarAddNodePick(
        itemId,
        nodeType,
        { addNode, setNodes },
        { alert },
        { onOpenStyleLibrary },
      );
    },
    [addNode, setNodes, alert, onOpenStyleLibrary],
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

  const dockItems = useMemo<Sbv1DockItem[]>(
    () => [
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
        name: "分镜脚本",
        icon: <FileText strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-rose-400 to-red-600",
        onClick: onQuickScript,
      },
      {
        id: "add-nodes",
        name: menuOpen ? "关闭菜单" : "更多节点",
        icon: menuOpen ? (
          <X strokeWidth={1.75} />
        ) : (
          <Plus strokeWidth={1.75} />
        ),
        color: "bg-gradient-to-br from-cyan-400 to-teal-600",
        onClick: onToggleMenu,
      },
    ],
    [menuOpen, onToggleMenu, onQuickImage, onPickFiles, onQuickScript, base],
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
      <Pro2AddNodePopover
        open={menuOpen}
        anchor={{ x: anchor.x, y: anchor.y - 320 }}
        sections={PRO2_TOOLBAR_ADD_MENU}
        onClose={() => setMenuOpen(false)}
        onPick={onPick}
      />
    </>
  );
}
