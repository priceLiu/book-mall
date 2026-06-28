export type ProjectAssetKind =
  | "CHARACTER"
  | "SCENE"
  | "PROP"
  | "OUTLINE"
  | "STORYBOARD_SCRIPT"
  | "AUDIO"
  | "STORYBOARD_IMAGE"
  | "STORYBOARD_VIDEO"
  | "DIGITAL_HUMAN"
  | "PRIVATE_PORTRAIT"
  | "STYLE"
  | "PROMPT"
  | "GROUP_BUNDLE"
  | "SCRIPT_PACKAGE";

export type AssetVisibility = "PRIVATE" | "TEAM_PUBLIC";

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

export type InsertMapResult = {
  nodeType: string;
  data: Record<string, unknown>;
  width?: number;
  height?: number;
};
