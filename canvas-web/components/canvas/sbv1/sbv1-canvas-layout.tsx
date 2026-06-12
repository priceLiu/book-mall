"use client";

import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { Sbv1CanvasToolbar } from "./sbv1-canvas-toolbar";

export type Sbv1CanvasLayoutProps = {
  projectId: string;
  onUndo: () => void;
  onRedo: () => void;
};

export function Sbv1CanvasLayout({
  projectId,
  onUndo,
  onRedo,
}: Sbv1CanvasLayoutProps) {
  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <FlowCanvas
        projectId={projectId}
        onUndo={onUndo}
        onRedo={onRedo}
        forceOnlyRenderVisible
        sbv1Canvas
      />
      <Sbv1CanvasToolbar />
    </div>
  );
}
