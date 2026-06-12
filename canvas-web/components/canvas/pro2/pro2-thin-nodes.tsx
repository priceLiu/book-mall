"use client";

import type { NodeProps } from "@xyflow/react";
import { useCanvasStore } from "@/lib/canvas/store";
import { PRO2_STAGE_BADGE_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { Pro2ThinCardShell } from "./thin-card-shell";

const COLUMN_LABELS: Record<string, string> = {
  "story-pro2-character": "人物设计",
  "story-pro2-scene": "场景设计",
  "story-pro2-frame": "分镜脚本",
  "story-pro2-video": "分镜视频",
};

function rowCount(data: Record<string, unknown>): number {
  const rows = data.rows;
  return Array.isArray(rows) ? rows.length : 0;
}

export function Pro2ColumnThinNode({ data, selected, type }: NodeProps) {
  const label = COLUMN_LABELS[type ?? ""] ?? "工作区";
  const rows = rowCount(data as Record<string, unknown>);
  return (
    <Pro2ThinCardShell
      title={label}
      selected={selected}
      badge={<span className={PRO2_STAGE_BADGE_CLASS}>{rows} 镜</span>}
      inputs={[{ id: "in_text", label: "输入" }]}
      outputs={[{ id: "text", label: "输出" }]}
    />
  );
}

export function StoryPro2ScriptHubThinNode({ id, data, selected }: NodeProps) {
  const d = data as StoryProScriptHubNodeData;
  const finalized = d.scriptFinalized ? "已定稿" : "编辑中";
  return (
    <Pro2ThinCardShell
      title="故事剧本"
      selected={selected}
      badge={<span className={PRO2_STAGE_BADGE_CLASS}>{finalized}</span>}
      inputs={[{ id: "in_text", label: "故事" }]}
      outputs={[{ id: "text", label: "剧本" }]}
    />
  );
}

export function StoryPro2StyleThinNode({ data, selected }: NodeProps) {
  const d = data as { styleFinalized?: boolean };
  return (
    <Pro2ThinCardShell
      title="风格定义"
      selected={selected}
      badge={
        <span className={PRO2_STAGE_BADGE_CLASS}>
          {d.styleFinalized ? "已定稿" : "编辑中"}
        </span>
      }
      inputs={[{ id: "in_text", label: "剧本" }]}
      outputs={[{ id: "text", label: "风格" }]}
    />
  );
}

export function JianyingExportPro2ThinNode({ data, selected }: NodeProps) {
  const d = data as { label?: string; mediaRenderResult?: { downloadUrl?: string } };
  return (
    <Pro2ThinCardShell
      title={d.label ?? "剪映导出 · 2.0"}
      selected={selected}
      badge={
        <span className={PRO2_STAGE_BADGE_CLASS}>
          {d.mediaRenderResult?.downloadUrl ? "成片就绪" : "待导出"}
        </span>
      }
      inputs={[{ id: "in_storyboard", label: "视频列" }]}
    />
  );
}
