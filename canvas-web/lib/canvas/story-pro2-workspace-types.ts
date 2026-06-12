/**
 * 影视专业版 2.0 工作区类型 — 首期字段 1:1 映射 story-pro，便于 runner 复用
 */
export type {
  StoryProStarterNodeData,
  StoryProStarterMode,
  StoryProScriptHubNodeData,
  StoryProStyleNodeData,
  StoryProCharacterRow,
  StoryProSceneRow,
  StoryProFrameRow,
  StoryProVideoRow,
  StoryProFeasibilityAssessment,
  StoryProFinalizedScriptSnapshot,
} from "./story-pro-workspace-types";

import type { ImageNodeData } from "./types";

/** 2.0 图片节点 · 组内子节点角色 */
export type Pro2ImageMediaRole = "generic" | "frame" | "character-three-view";

/** 2.0 角色三视图节点 data（独立 type · 横向矩形） */
export type StoryPro2ThreeViewNodeData = ImageNodeData & {
  dockInput?: string;
  pro2RowKey?: string;
  pro2HubNodeId?: string;
  pro2ControllerNodeId?: string;
  pro2GroupId?: string;
  dockStyleRef?: {
    presetId: string;
    name: string;
    prompt: string;
    imageUrl: string;
  };
};

/** 2.0 图片节点 data */
export type StoryPro2ImageNodeData = ImageNodeData & {
  /** 底部输入坞提示词（@ 引用上游） */
  dockInput?: string;
  /** 组内分镜 / 三视图子节点 */
  pro2MediaRole?: Pro2ImageMediaRole;
  pro2RowKey?: string;
  pro2HubNodeId?: string;
  /** 数据锚点列节点 id（story-pro2-frame / story-pro2-character） */
  pro2ControllerNodeId?: string;
  pro2GroupId?: string;
  /** Dock 已套用风格库 */
  dockStyleRef?: {
    presetId: string;
    name: string;
    prompt: string;
    imageUrl: string;
  };
};

/** 2.0 启动节点 data（与 pro 同构，独立 type 字符串） */
export type StoryPro2StarterNodeData = import("./story-pro-workspace-types").StoryProStarterNodeData;

export type StoryPro2ScriptHubNodeData =
  import("./story-pro-workspace-types").StoryProScriptHubNodeData;

export type StoryPro2StyleNodeData =
  import("./story-pro-workspace-types").StoryProStyleNodeData;

/** 2.0 风格库素材卡（LibTV · 素材-风格-xxx） */
export type StoryPro2StyleAssetNodeData = {
  presetId: string;
  styleName: string;
  stylePrompt: string;
  imageUrl: string;
  label: string;
  styleAnchorZh?: string;
  mainStyle?: import("./story-pro-workspace-types").StoryProMainStyle;
  colorTone?: import("./story-pro-workspace-types").StoryProColorTone;
  renderQuality?: import("./story-pro-workspace-types").StoryProRenderQuality;
};

/** 检视面板内编辑用（与 pro 字段同构） */
export type StoryPro2StarterInspectorData = StoryPro2StarterNodeData;
export type StoryPro2StyleInspectorData = StoryPro2StyleNodeData;

/** 工作区 ID 链（与 pro 同构） */
export type StoryPro2WorkspaceIds =
  import("./story-pro-workspace-types").StoryProWorkspaceIds;
