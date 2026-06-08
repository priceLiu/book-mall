export type AssetVisibility = "PRIVATE" | "TEAM_PUBLIC";

export type TextToImageLibraryItem = {
  id: string;
  imageUrl: string;
  prompt: string | null;
  /** ISO timestamp */
  createdAt: string;
  /** 团队空间：可见域与归属（个人空间字段缺省/PRIVATE） */
  visibility?: AssetVisibility;
  mine?: boolean;
  canToggle?: boolean;
};
