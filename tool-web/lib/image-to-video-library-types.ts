export type AssetVisibility = "PRIVATE" | "TEAM_PUBLIC";

export type ImageToVideoLibraryItem = {
  id: string;
  videoUrl: string;
  prompt: string | null;
  mode: string;
  resolution: string;
  durationSec: number;
  seed: string | null;
  modelLabel: string | null;
  retainUntil: string;
  createdAt: string;
  /** 团队空间：可见域与归属（个人空间字段缺省/PRIVATE） */
  visibility?: AssetVisibility;
  mine?: boolean;
  canToggle?: boolean;
};

export type ToolLibraryQuota = {
  max: number;
  used: number;
};
