import type {
  MainImageHitReplicaAspectRatio,
  MainImageHitReplicaOutputResolution,
} from "@/lib/main-image-hit-replica-settings";

export const MAIN_IMAGE_HIT_REPLICA_MAX_REF = 20;
export const MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT = 6;

export type MainImageHitReplicaRefRole = "reference" | "product";

export type MainImageHitReplicaReference = {
  id: string;
  role: MainImageHitReplicaRefRole;
  label: string;
  ossUrl: string;
  sortIndex: number;
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
  keepOutputStyleConsistent?: boolean;
  language: string;
  /** 参考图 / 出图比例（含 970:600 等详情常用画幅） */
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

export type MainImageHitReplicaProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: MainImageHitReplicaSettings;
  references: MainImageHitReplicaReference[];
  output: { results: MainImageHitReplicaResult[] };
  meta: {
    phase?: "setup" | "generating" | "done";
    genStartedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type MainImageHitReplicaSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  thumbnailUrl: string | null;
};

export const MAIN_IMAGE_HIT_REPLICA_CATEGORY_OPTIONS: Array<{
  id: MainImageHitReplicaCategory;
  label: string;
}> = [
  { id: "ecom_product", label: "电商商品图" },
  { id: "apparel_ecom", label: "服饰电商图" },
  { id: "marketing_poster", label: "营销海报" },
  { id: "social_media", label: "社媒图文" },
  { id: "creative_poster", label: "创意海报" },
  { id: "other", label: "其他" },
];