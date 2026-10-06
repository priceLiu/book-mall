"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { FlowCanvas } from "@/lib/canvas/canvas-page-heavy-chunks";
import { CanvasCreditsToastHost } from "@/components/canvas/canvas-credits-toast-host";
import { openPlatformAssetHub } from "@/components/canvas/platform-asset-hub/platform-asset-hub-host";
import { useCanvasStore } from "@/lib/canvas/store";
import { Pro2CanvasToolbar } from "./pro2-canvas-toolbar";
import { shouldShowCrewBulletinRail } from "@/lib/canvas/crew-bulletin-context";
import { useCrewCollaborationAccess } from "@/lib/canvas/use-crew-collaboration-access";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  useCrewBulletinSubscription,
  broadcastCrewBulletinLocalChange,
} from "@/lib/canvas/use-crew-bulletin-subscription";

const Pro2CrewBulletin = dynamic(
  () =>
    import("./pro2-crew-bulletin").then((m) => ({
      default: m.Pro2CrewBulletin,
    })),
  { ssr: false },
);

function Pro2CrewBulletinRail({
  projectId,
  enabled,
}: {
  projectId: string;
  enabled: boolean;
}) {
  const base = useBookMallBaseUrl();
  useCrewBulletinSubscription(base, projectId, enabled);
  if (!enabled) return null;
  return <Pro2CrewBulletin />;
}

export type Pro2CanvasLayoutProps = {
  projectId: string;
  onUndo: () => void;
  onRedo: () => void;
};

export function Pro2CanvasLayout({
  projectId,
  onUndo,
  onRedo,
}: Pro2CanvasLayoutProps) {
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const collaboration = useCrewCollaborationAccess();
  const nodes = useCanvasStore((s) => s.nodes);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const showCrewBulletin = shouldShowCrewBulletinRail(
    nodes,
    graphMeta ?? undefined,
    collaboration,
  );

  useEffect(() => {
    const onChanged = () => broadcastCrewBulletinLocalChange(projectId);
    window.addEventListener("canvas:crew-bulletin-changed", onChanged);
    return () =>
      window.removeEventListener("canvas:crew-bulletin-changed", onChanged);
  }, [projectId]);

  useEffect(() => {
    const onOpen = () => openPlatformAssetHub({ section: "style" });
    window.addEventListener("canvas:open-pro2-style-library", onOpen);
    return () =>
      window.removeEventListener("canvas:open-pro2-style-library", onOpen);
  }, []);

  return (
    <div className="relative h-full min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden">
      <FlowCanvas
        projectId={projectId}
        onUndo={onUndo}
        onRedo={onRedo}
        forceOnlyRenderVisible
        pro2FloatingInspector
      />
      <Pro2CanvasToolbar
        projectId={projectId}
        onOpenStyleLibrary={() => {
          setPro2StyleLibImageNodeId(null);
          openPlatformAssetHub({ section: "catalog" });
        }}
        onOpenMyHistory={() => {
          window.dispatchEvent(new CustomEvent("canvas:open-my-history"));
        }}
      />
      <Pro2CrewBulletinRail projectId={projectId} enabled={showCrewBulletin} />
      <CanvasCreditsToastHost />
    </div>
  );
}
