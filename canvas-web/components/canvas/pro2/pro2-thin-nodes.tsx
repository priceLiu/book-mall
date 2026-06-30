"use client";

import type { NodeProps } from "@xyflow/react";
import { PRO2_STAGE_BADGE_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { Pro2ThinCardShell } from "./thin-card-shell";

const COLUMN_LABELS: Record<string, string> = {
  "story-pro2-character": "人物设计",
  "story-pro2-scene": "场景设计",
  "story-pro2-frame": "分镜脚本",
  "story-pro2-video": "分镜视频",
  "story-pro2-prop": "道具设计",
  "story-pro2-mood": "氛围设计",
  "story-pro2-audio": "音效设计",
};

/** 占位节点（功能后补）：仅展示卡片，不参与生成 */
const PLACEHOLDER_COLUMN_TYPES = new Set([
  "story-pro2-prop",
  "story-pro2-mood",
  "story-pro2-audio",
]);

const COLUMN_UNIT: Record<string, string> = {
  "story-pro2-prop": "项",
  "story-pro2-mood": "项",
  "story-pro2-audio": "项",
};

function rowCount(data: Record<string, unknown>): number {
  const rows = data.rows;
  return Array.isArray(rows) ? rows.length : 0;
}

export function Pro2ColumnThinNode({ data, selected, type }: NodeProps) {
  const t = type ?? "";
  const label = COLUMN_LABELS[t] ?? "工作区";
  const rows = rowCount(data as Record<string, unknown>);
  const isPlaceholder = PLACEHOLDER_COLUMN_TYPES.has(t);
  const unit = COLUMN_UNIT[t] ?? "镜";
  return (
    <Pro2ThinCardShell
      title={label}
      selected={selected}
      badge={
        <span className={PRO2_STAGE_BADGE_CLASS}>
          {isPlaceholder ? "待开发" : `${rows} ${unit}`}
        </span>
      }
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
