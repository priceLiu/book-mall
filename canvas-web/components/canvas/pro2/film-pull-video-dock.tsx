"use client";

import { Clapperboard } from "lucide-react";

import {
  Pro2DockHeader,
  Pro2InputDockShell,
} from "@/components/canvas/pro2/pro2-input-dock-shell";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";

type Props = {
  nodeId: string;
  filmPullProjectId?: string;
  filmPullScriptHubId?: string;
  videoUrl?: string;
  placement: LibtvDockFlowPlacement;
  hidden?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
};

/** 视频节点 Dock · 拉片主路径已迁至剧本 Hub（专业版 + 发送「拉片」） */
export function FilmPullVideoDock({
  nodeId,
  videoUrl,
  placement,
  hidden,
}: Props) {
  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      hidden={hidden}
      anchorNodeId={nodeId}
      header={
        <Pro2DockHeader
          compact
          actionRow={
            <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-white/90">
              <Clapperboard className="h-3.5 w-3.5" strokeWidth={1.75} />
              专业拉片 · 请到剧本节点
            </span>
          }
        />
      }
    >
      <p className="px-3 py-2 text-xs leading-relaxed text-white/60">
        在节点内上传 / 粘贴 / 拖入 ≤90s 源视频，连到剧本节点后：Dock 右上角选
        <span className="text-white/85"> 专业版 </span>
        ，输入「拉片」发送。制作包会直接写入 Hub，不再从此处开始拉片或导入。
        {videoUrl?.trim() ? " 本节点已有源视频。" : " 请先为节点添加源视频。"}
      </p>
    </Pro2InputDockShell>
  );
}
