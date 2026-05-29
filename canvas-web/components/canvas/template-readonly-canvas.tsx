"use client";

import { useMemo } from "react";
import {
  Background,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  type DefaultEdgeOptions,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { onCanvasWheelCapture } from "@/lib/canvas/canvas-form-wheel";
import { migrateGraphV1ToV2 } from "@/lib/canvas/migrate";
import type { CanvasGraph } from "@/lib/canvas/types";
import {
  canvasFlowEdgeTypes,
  canvasFlowNodeTypes,
} from "./flow-canvas";

const defaultEdgeOptions: DefaultEdgeOptions = { animated: false };

function TemplateReadonlyCanvasInner({ graph }: { graph: CanvasGraph }) {
  const { nodes, edges, viewport } = useMemo(() => {
    const g = migrateGraphV1ToV2(graph);
    return {
      nodes: g.nodes.map((n) => ({
        ...n,
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
      })),
      edges: g.edges,
      viewport: g.viewport ?? { x: 0, y: 0, zoom: 1 },
    };
  }, [graph]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={canvasFlowNodeTypes}
      edgeTypes={canvasFlowEdgeTypes}
      defaultViewport={viewport}
      defaultEdgeOptions={defaultEdgeOptions}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      edgesFocusable={false}
      nodesFocusable={false}
      panOnDrag
      panOnScroll
      panOnScrollMode={PanOnScrollMode.Free}
      zoomOnScroll={false}
      zoomActivationKeyCode="Control"
      noWheelClassName="nowheel"
      selectionOnDrag={false}
      deleteKeyCode={null}
      fitView
      proOptions={{ hideAttribution: true }}
      className="bg-[var(--canvas-bg)]"
    >
      <Background gap={24} size={1} color="rgba(255,255,255,0.06)" />
    </ReactFlow>
  );
}

/** 模板只读预览：可平移 / 缩放，节点不可编辑、不可选中。 */
export function TemplateReadonlyCanvas({ graph }: { graph: CanvasGraph }) {
  return (
    <ReactFlowProvider>
      <div
        className="canvas-flow-wrap h-full w-full overscroll-none [&_.react-flow__edge]:pointer-events-none [&_.react-flow__node]:pointer-events-none"
        onWheelCapture={onCanvasWheelCapture}
      >
        <TemplateReadonlyCanvasInner graph={graph} />
      </div>
    </ReactFlowProvider>
  );
}
