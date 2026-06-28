import type { AssetVisibility, ProjectAssetKind } from "@prisma/client";

export const PROJECT_ASSET_KIND_LABELS: Record<ProjectAssetKind, string> = {
  CHARACTER: "角色",
  SCENE: "场景",
  PROP: "道具",
  OUTLINE: "大纲",
  STORYBOARD_SCRIPT: "分镜脚本",
  AUDIO: "音频",
  STORYBOARD_IMAGE: "分镜图",
  STORYBOARD_VIDEO: "分镜视频",
  SCRIPT_PACKAGE: "剧本包",
  DIGITAL_HUMAN: "数字人",
  PRIVATE_PORTRAIT: "私域人像库",
  STYLE: "风格",
  PROMPT: "提示词",
  GROUP_BUNDLE: "组资产",
};

export const PROJECT_ASSET_LEASE_TTL_MS = 15 * 60 * 1000;

export type ProjectAssetRefRecord = {
  id: string;
  slotKey: string;
  label: string;
  mediaUrl: string;
  mimeType: string | null;
  meta: Record<string, unknown> | null;
  sortOrder: number;
};

export type ProjectAssetRecord = {
  id: string;
  tenantId: string | null;
  ownerUserId: string;
  visibility: AssetVisibility;
  kind: ProjectAssetKind;
  displayName: string;
  description: string;
  thumbnailUrl: string;
  sourceProjectId: string | null;
  sourceNodeId: string | null;
  sourceEdition: string | null;
  locked: boolean;
  editLockUserId: string | null;
  editLockExpiresAt: string | null;
  version: number;
  payload: Record<string, unknown>;
  refs: ProjectAssetRefRecord[];
  createdAt: string;
  updatedAt: string;
  /** 聚合自旧表时标记，便于 UI 区分 */
  legacySource?: string;
};

export type CreateProjectAssetInput = {
  kind: ProjectAssetKind;
  displayName: string;
  description?: string;
  thumbnailUrl?: string;
  visibility?: AssetVisibility;
  sourceProjectId?: string | null;
  sourceNodeId?: string | null;
  sourceEdition?: string | null;
  payload?: Record<string, unknown>;
  refs?: Array<{
    slotKey: string;
    label?: string;
    mediaUrl: string;
    mimeType?: string | null;
    meta?: Record<string, unknown> | null;
    sortOrder?: number;
  }>;
};

export type ListProjectAssetsFilter = {
  kind?: ProjectAssetKind | null;
  projectId?: string | null;
  scope?: "all" | "project" | "library";
  visibility?: AssetVisibility | "all";
  search?: string | null;
  includeLegacy?: boolean;
};

export type InsertMapInput = {
  edition: "pro" | "pro2" | "sbv1" | "standard";
};

export type InsertMapResult = {
  nodeType: string;
  data: Record<string, unknown>;
  width?: number;
  height?: number;
};
