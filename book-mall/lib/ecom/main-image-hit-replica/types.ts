import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";

export const MAIN_IMAGE_HIT_REPLICA_ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "9:16",
  "16:9",
  "970:600",
  "1464:600",
  "600:450",
] as const;

export type MainImageHitReplicaAspectRatio =
  (typeof MAIN_IMAGE_HIT_REPLICA_ASPECT_RATIOS)[number];

export type MainImageHitReplicaOutputResolution = "1K" | "2K";

export const ECOM_MAIN_IMAGE_HIT_REPLICA_MODULE = "main-image-hit-replica";
export const ECOM_MAIN_IMAGE_HIT_REPLICA_TOOL_KEY = "ecom-toolkit__main-image-hit-replica";
export const ECOM_MAIN_IMAGE_HIT_REPLICA_ACTION = "replicate";

export const MAIN_IMAGE_HIT_REPLICA_MAX_REF_IMAGES = 20;
export const MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT_IMAGES = 6;

export type MainImageHitReplicaRefRole = "reference" | "product";

export type MainImageHitReplicaReference = {
  id: string;
  role: MainImageHitReplicaRefRole;
  label: string;
  ossUrl: string;
  sortIndex: number;
  /** 单张参考图专属要求（选填） */
  referenceRequirement?: string;
};

export type MainImageHitReplicaCategory =
  | "ecom_product"
  | "apparel_ecom"
  | "marketing_poster"
  | "social_media"
  | "creative_poster"
  | "other";

export type MainImageHitReplicaDegree = "style_reference" | "high_fidelity";

export type MainImageHitReplicaSettings = {
  replicaCategory: MainImageHitReplicaCategory;
  replicaDegree: MainImageHitReplicaDegree;
  globalRequirements?: string;
  /** 多张参考图成片时统一色调 / 字体气质 / 光影（默认开启） */
  keepOutputStyleConsistent?: boolean;
  language: string;
  imageRatio: MainImageHitReplicaAspectRatio;
  outputResolution: MainImageHitReplicaOutputResolution;
  imageGenSize?: string;
  imageModelKey?: string;
  visionModelKey?: string;
};

export type MainImageHitReplicaResult = {
  id: string;
  index: number;
  sourceRefId: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
  status: "pending" | "generating" | "ready" | "failed";
  failMessage?: string;
};

export type MainImageHitReplicaOutput = {
  results: MainImageHitReplicaResult[];
};

export type MainImageHitReplicaMeta = {
  phase?: "setup" | "generating" | "done";
  genStartedAt?: string;
  lastBusyStaleAt?: string;
};

export type MainImageHitReplicaProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: MainImageHitReplicaSettings;
  references: MainImageHitReplicaReference[];
  output: MainImageHitReplicaOutput;
  meta: MainImageHitReplicaMeta;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_MAIN_IMAGE_HIT_REPLICA_SETTINGS: MainImageHitReplicaSettings = {
  replicaCategory: "ecom_product",
  replicaDegree: "high_fidelity",
  globalRequirements: "",
  keepOutputStyleConsistent: true,
  language: "中文",
  imageRatio: "1:1",
  outputResolution: "2K",
  imageGenSize: "1:1_2K",
};

export function hitReplicaAspectToEcomRatio(ratio: string): EcomImageRatio {
  const standard = new Set(["1:1", "3:4", "4:5", "9:16", "16:9"]);
  if (standard.has(ratio)) return ratio as EcomImageRatio;
  if (ratio === "600:450") return "4:5";
  if (ratio === "970:600" || ratio === "1464:600") return "16:9";
  return "1:1";
}

export function hitReplicaBuildImageGenSize(
  aspect: string,
  resolution: MainImageHitReplicaOutputResolution,
): string {
  const r = hitReplicaAspectToEcomRatio(aspect);
  return `${r}_${resolution}`;
}

export const MAIN_IMAGE_HIT_REPLICA_CATEGORY_LABELS: Record<
  MainImageHitReplicaCategory,
  string
> = {
  ecom_product: "电商商品图",
  apparel_ecom: "服饰电商图",
  marketing_poster: "营销海报",
  social_media: "社媒图文",
  creative_poster: "创意海报",
  other: "其他",
};