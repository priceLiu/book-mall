import type { ProjectAssetKind } from "./project-asset-types";

export const PROJECT_ASSET_KIND_LABELS: Record<ProjectAssetKind, string> = {
  CHARACTER: "角色",
  SCENE: "场景",
  PROP: "道具",
  OUTLINE: "大纲",
  STORYBOARD_SCRIPT: "分镜脚本",
  AUDIO: "音频",
  STORYBOARD_IMAGE: "分镜图",
  STORYBOARD_VIDEO: "分镜视频",
  DIGITAL_HUMAN: "数字人",
  STYLE: "风格",
  PROMPT: "提示词",
  GROUP_BUNDLE: "组资产",
};

export const PROJECT_ASSET_TAB_KINDS: ProjectAssetKind[] = [
  "CHARACTER",
  "SCENE",
  "PROP",
  "OUTLINE",
  "STORYBOARD_SCRIPT",
  "AUDIO",
  "STORYBOARD_IMAGE",
  "STORYBOARD_VIDEO",
  "DIGITAL_HUMAN",
  "STYLE",
  "PROMPT",
  "GROUP_BUNDLE",
];

export function defaultKindForNodeType(nodeType: string): ProjectAssetKind {
  const map: Record<string, ProjectAssetKind> = {
    "story-pro2-starter": "OUTLINE",
    "story-pro-starter": "OUTLINE",
    "story-pro2-script-hub": "STORYBOARD_SCRIPT",
    "story-pro-script-hub": "STORYBOARD_SCRIPT",
    "story-pro2-image": "STORYBOARD_IMAGE",
    "story-pro2-three-view": "CHARACTER",
    "sbv1-image": "STORYBOARD_IMAGE",
    "sbv1-video-engine": "STORYBOARD_VIDEO",
    "story-pro2-style-asset": "STYLE",
    "story-pro-style": "STYLE",
    "story-pro-character": "CHARACTER",
    "story-pro-scene": "SCENE",
    "story-pro-frame": "STORYBOARD_IMAGE",
    "story-pro-video": "STORYBOARD_VIDEO",
    group: "GROUP_BUNDLE",
  };
  return map[nodeType] ?? "STORYBOARD_IMAGE";
}
