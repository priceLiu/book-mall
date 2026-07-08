"use client";

import { useEffect, useMemo, useState } from "react";
import { useNodes, useReactFlow, useViewport } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { useCanvasStore } from "@/lib/canvas/store";
import { CanvasNodeEmbeddedProvider } from "@/lib/canvas/canvas-node-embedded-context";
import {
  PRO2_CARD_SUBTITLE_CLASS,
  PRO2_CARD_TITLE_CLASS,
  PRO2_NODE_BORDER,
} from "@/lib/canvas/story-pro2-node-chrome";
import { isStoryPro2PipelineNode } from "@/lib/canvas/story-pro2-pipeline";
import { StoryPro2StarterInspector } from "./story-pro2-starter-node-inspector";
import { StoryPro2ScriptHubInspector } from "./story-pro2-script-hub-node-inspector";
import { StoryPro2StyleInspector } from "./story-pro2-style-node-inspector";
import { JianyingExportPro2Inspector } from "./jianying-export-pro-node-inspector";
import { Pro2ColumnInspector } from "./pro2-column-inspector";

const GAP = 10;
const VIEWPORT_MARGIN = 12;
const MIN_PANEL_W = 380;
const MAX_PANEL_W = 520;
const MAX_PANEL_H = 640;

const PRO2_NODE_LABELS: Record<string, string> = {
  "story-pro2-starter": "影视专业 · 启动",
  "story-pro2-script-hub": "故事剧本",
  "story-pro2-style": "风格定义",
  "story-pro2-character": "人物设计",
  "story-pro2-scene": "场景设计",
  "story-pro2-frame": "分镜脚本",
  "story-pro2-video": "分镜视频",
  "jianying-export-pro2": "导出剪辑",
};

function inspectorProps(node: CanvasFlowNode): NodeProps {
  return {
    id: node.id,
    data: node.data,
    selected: true,
    type: node.type,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: node.position.x,
    positionAbsoluteY: node.position.y,
  } as NodeProps;
}

function InspectorBody({ node }: { node: CanvasFlowNode }) {
  const props = inspectorProps(node);
  switch (node.type) {
    case "story-pro2-starter":
      return <StoryPro2StarterInspector {...props} />;
    case "story-pro2-script-hub":
      return <StoryPro2ScriptHubInspector {...props} />;
    case "story-pro2-style":
      return <StoryPro2StyleInspector {...props} />;
    case "story-pro2-character":
    case "story-pro2-scene":
    case "story-pro2-frame":
      return <Pro2ColumnInspector node={node} />;
    case "jianying-export-pro2":
      return <JianyingExportPro2Inspector {...props} />;
    default:
      return (
        <div className="p-4 text-[12px] text-white/60">
          未知节点类型：{node.type}
        </div>
      );
  }
}

function usePanelPlacement(nodeId: string | null) {
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewport = useViewport();
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const sync = () =>
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return useMemo(() => {
    if (!nodeId || windowSize.w <= 0) return null;

    const internal = getInternalNode(nodeId) as
      | {
          measured?: { width?: number; height?: number };
          position: { x: number; y: number };
          internals?: { positionAbsolute?: { x: number; y: number } };
        }
      | undefined;
    if (!internal) return null;

    const pos = internal.internals?.positionAbsolute ?? internal.position;
    const w = internal.measured?.width ?? 360;
    const h = internal.measured?.height ?? 140;

    const topLeft = flowToScreenPosition({ x: pos.x, y: pos.y });
    const bottomRight = flowToScreenPosition({ x: pos.x + w, y: pos.y + h });
    const nodeScreenW = Math.max(120, bottomRight.x - topLeft.x);

    const panelW = Math.min(
      MAX_PANEL_W,
      windowSize.w - VIEWPORT_MARGIN * 2,
      Math.max(MIN_PANEL_W, nodeScreenW),
    );

    // 默认锚定在节点底边正中，不翻到节点上方
    const anchorBottom = flowToScreenPosition({
      x: pos.x + w / 2,
      y: pos.y + h,
    });
    const top = anchorBottom.y + GAP;

    const halfW = panelW / 2;
    const left = Math.min(
      windowSize.w - VIEWPORT_MARGIN - halfW,
      Math.max(VIEWPORT_MARGIN + halfW, anchorBottom.x),
    );

    const availableBelow = windowSize.h - VIEWPORT_MARGIN - top;
    const maxH = Math.min(
      MAX_PANEL_H,
      Math.round(windowSize.h * 0.72),
      Math.max(220, availableBelow),
    );

    return {
      left,
      top,
      panelW,
      maxH,
    };
  }, [nodeId, flowToScreenPosition, getInternalNode, viewport, windowSize]);
}

/** 影视专业版 2.0 · 节点下方浮动检视（点击空白关闭） */
export function Pro2FloatingInspector() {
  const rfNodes = useNodes();
  const storeNodes = useCanvasStore((s) => s.nodes);

  const selectedRf = useMemo(() => {
    const picked = rfNodes.filter(
      (n) => n.selected && isStoryPro2PipelineNode(n.type ?? ""),
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const storeNode = useMemo(() => {
    if (!selectedRf) return null;
    return storeNodes.find((n) => n.id === selectedRf.id) ?? null;
  }, [selectedRf, storeNodes]);

  const placement = usePanelPlacement(selectedRf?.id ?? null);
  const title = storeNode?.type
    ? (PRO2_NODE_LABELS[storeNode.type] ?? storeNode.type)
    : "节点";

  const visualGroupController =
    (storeNode?.type === "story-pro2-character" ||
      storeNode?.type === "story-pro2-frame") &&
    Boolean(
      (storeNode.data as { pro2VisualGroupId?: string }).pro2VisualGroupId,
    );

  if (
    !storeNode ||
    !placement ||
    !isStoryPro2PipelineNode(storeNode.type ?? "") ||
    storeNode.type === "story-pro2-starter" ||
    storeNode.type === "story-pro2-script-hub" ||
    storeNode.type === "story-pro2-image" ||
    storeNode.type === "story-pro2-three-view" ||
    storeNode.type === "story-pro2-style-asset" ||
    storeNode.type === "story-pro2-audio" ||
    storeNode.type === "story-pro2-video" ||
    storeNode.type === "jianying-export-pro2" ||
    storeNode.type === "jianying-auto-render-pro2" ||
    storeNode.type === "group" ||
    visualGroupController
  ) {
    return null;
  }

  return (
    <div
      className="pro2-floating-inspector pointer-events-auto fixed z-[90]"
      style={{
        left: placement.left,
        top: placement.top,
        width: placement.panelW,
        maxHeight: placement.maxH,
        transform: "translate(-50%, 0)",
      }}
      role="dialog"
      aria-label={`${title}编辑面板`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="flex max-h-[inherit] flex-col overflow-hidden rounded-2xl border shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
        style={{
          borderColor: PRO2_NODE_BORDER,
          background:
            "linear-gradient(165deg, rgba(22, 18, 32, 0.97) 0%, rgba(14, 12, 20, 0.98) 100%)",
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-violet-400/12 px-4 py-3">
          <div className="min-w-0">
            <p className={PRO2_CARD_TITLE_CLASS}>{title}</p>
          </div>
        </header>

        <CanvasNodeEmbeddedProvider>
          <div
            className="pro2-inspector-embed min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2"
            style={{ maxHeight: placement.maxH - 52 }}
          >
            <InspectorBody node={storeNode} />
          </div>
        </CanvasNodeEmbeddedProvider>
      </div>
    </div>
  );
}
