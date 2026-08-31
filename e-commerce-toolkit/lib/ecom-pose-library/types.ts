export type EcomPoseCategory =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M";

export type EcomPoseLibraryEntry = {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  tags?: Record<string, unknown>;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomPoseLibraryCatalog = {
  poses: EcomPoseLibraryEntry[];
};

export const ECOM_POSE_CATEGORIES: EcomPoseCategory[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
];

export const ECOM_POSE_CATEGORY_LABEL: Record<EcomPoseCategory, string> = {
  A: "基础站姿",
  B: "行走动态",
  C: "侧身扭转",
  D: "蹲姿低重心",
  E: "背面特殊",
  F: "手部细节",
  G: "头部表情",
  H: "户外运动",
  I: "逛街生活",
  J: "商务通勤",
  K: "红毯晚宴",
  L: "戏剧夸张",
  M: "综合补充",
};
