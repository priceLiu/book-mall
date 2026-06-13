import type { ExportProjectAssetDraft } from "./project-asset-export";
import type { ProjectAssetKind } from "./project-asset-types";
import type { CanvasNodeRuntime } from "./types";

export type StoryProColumnRowSnapshot = {
  key: string;
  label: string;
  prompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
};

function mediaFromRuntime(rt?: CanvasNodeRuntime): {
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
} {
  const url = rt?.ossUrl ?? rt?.ephemeralUrl;
  if (!url) return {};
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return { videoUrl: url };
  }
  if (/\.(mp3|wav|m4a|aac)(\?|$)/i.test(url)) {
    return { audioUrl: url };
  }
  return { imageUrl: url };
}

const COLUMN_KIND: Record<
  "story-pro-character" | "story-pro-frame" | "story-pro-video",
  ProjectAssetKind
> = {
  "story-pro-character": "CHARACTER",
  "story-pro-frame": "STORYBOARD_IMAGE",
  "story-pro-video": "STORYBOARD_VIDEO",
};

const COLUMN_TITLES: Record<
  "story-pro-character" | "story-pro-frame" | "story-pro-video",
  string
> = {
  "story-pro-character": "角色列",
  "story-pro-frame": "分镜图列",
  "story-pro-video": "分镜视频列",
};

export function exportStoryProColumnToDraft(input: {
  projectId: string;
  nodeId: string;
  nodeType: "story-pro-character" | "story-pro-frame" | "story-pro-video";
  rows: StoryProColumnRowSnapshot[];
}): ExportProjectAssetDraft {
  const kind = COLUMN_KIND[input.nodeType];
  const refs: ExportProjectAssetDraft["refs"] = [];
  let thumbnailUrl = "";

  for (const row of input.rows) {
    const url = row.imageUrl ?? row.videoUrl ?? row.audioUrl;
    if (row.imageUrl) {
      refs.push({
        slotKey: row.key,
        label: row.label,
        mediaUrl: row.imageUrl,
      });
      if (!thumbnailUrl) thumbnailUrl = row.imageUrl;
    }
    if (row.videoUrl) {
      refs.push({
        slotKey: `${row.key}_video`,
        label: row.label,
        mediaUrl: row.videoUrl,
        mimeType: "video/*",
      });
      if (!thumbnailUrl) thumbnailUrl = row.videoUrl;
    }
    if (row.audioUrl) {
      refs.push({
        slotKey: `${row.key}_audio`,
        label: row.label,
        mediaUrl: row.audioUrl,
        mimeType: "audio/*",
      });
    }
  }

  const rowCount = input.rows.length;
  const displayName =
    rowCount === 1
      ? `${COLUMN_TITLES[input.nodeType]}·${input.rows[0]?.label || "未命名"}`
      : `${COLUMN_TITLES[input.nodeType]}·${rowCount} 项`;

  return {
    kind,
    displayName,
    description:
      input.rows
        .map((r) => r.prompt)
        .filter(Boolean)
        .join(" · ")
        .slice(0, 200) || `${COLUMN_TITLES[input.nodeType]}快照`,
    thumbnailUrl,
    sourceProjectId: input.projectId,
    sourceNodeId: input.nodeId,
    sourceEdition: "pro",
    payload: {
      columnType: input.nodeType,
      rows: input.rows,
    },
    refs,
  };
}

export function snapshotCharacterColumnRows(
  rows: Array<{
    key: string;
    name: string;
    prompt?: string;
    runtime?: CanvasNodeRuntime;
  }>,
): StoryProColumnRowSnapshot[] {
  return rows.map((r) => ({
    key: r.key,
    label: r.name,
    prompt: r.prompt,
    ...mediaFromRuntime(r.runtime),
  }));
}

export function snapshotFrameColumnRows(
  rows: Array<{
    key: string;
    frameIndex: number;
    scene?: string;
    prompt?: string;
    runtime?: CanvasNodeRuntime;
  }>,
): StoryProColumnRowSnapshot[] {
  return rows.map((r) => ({
    key: r.key,
    label: `镜${r.frameIndex}${r.scene ? `·${r.scene}` : ""}`,
    prompt: r.prompt,
    ...mediaFromRuntime(r.runtime),
  }));
}

export function snapshotVideoColumnRows(
  rows: Array<{
    key: string;
    frameIndex: number;
    videoPrompt?: string;
    frameImageUrl?: string;
    videoRuntime?: CanvasNodeRuntime;
    ttsRuntime?: CanvasNodeRuntime;
  }>,
): StoryProColumnRowSnapshot[] {
  return rows.map((r) => {
    const video = mediaFromRuntime(r.videoRuntime);
    const tts = mediaFromRuntime(r.ttsRuntime);
    return {
      key: r.key,
      label: `镜${r.frameIndex}`,
      prompt: r.videoPrompt,
      imageUrl: r.frameImageUrl || video.imageUrl,
      videoUrl: video.videoUrl,
      audioUrl: tts.audioUrl ?? tts.imageUrl,
    };
  });
}
