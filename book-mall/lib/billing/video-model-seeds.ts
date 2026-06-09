/**
 * 财务 2.0 — scenario-lab 与 seed 用的 30 个 PER_SEC 视频模型成本档。
 * 净成本经 M=4 发布后基准毛利 ≈75%（见 credit-pricing-formulas）。
 */
export interface VideoModelSeed {
  canonicalModelKey: string;
  displayName: string;
  vendor: string;
  tierRaw: string;
  listCostYuan: number;
  discountRate: number;
}

/** 视频池积分 = 月积分 × 20%（与 docs/定价与风控.md 一致）。 */
export function deriveVideoMonthlyCredits(monthlyCredits: number): number {
  return Math.round(monthlyCredits * 0.2);
}

export const VIDEO_MODEL_SEEDS: VideoModelSeed[] = [
  // —— 阿里云 / 百炼 ——
  { canonicalModelKey: "happyhorse-r2v", displayName: "HappyHorse 参考图生视频", vendor: "aliyun", tierRaw: "标准", listCostYuan: 0.9, discountRate: 0.1 },
  { canonicalModelKey: "happyhorse-i2v", displayName: "HappyHorse 图生视频 1.0", vendor: "aliyun", tierRaw: "标准", listCostYuan: 0.88, discountRate: 0.1 },
  { canonicalModelKey: "happyhorse-i2v-720p", displayName: "HappyHorse 图生视频 720P", vendor: "aliyun", tierRaw: "720P", listCostYuan: 0.72, discountRate: 0.1 },
  { canonicalModelKey: "happyhorse-i2v-1080p", displayName: "HappyHorse 图生视频 1080P", vendor: "aliyun", tierRaw: "1080P", listCostYuan: 0.95, discountRate: 0.1 },
  { canonicalModelKey: "wanxiang-video-2.6", displayName: "通义万相 2.6 视频", vendor: "aliyun", tierRaw: "720P", listCostYuan: 0.48, discountRate: 0.1 },
  { canonicalModelKey: "wanxiang-video-2.6-1080p", displayName: "通义万相 2.6 视频 1080P", vendor: "aliyun", tierRaw: "1080P", listCostYuan: 0.62, discountRate: 0.1 },
  { canonicalModelKey: "wanxiang-video-2.7", displayName: "通义万相 2.7 视频", vendor: "aliyun", tierRaw: "720P", listCostYuan: 0.52, discountRate: 0.1 },
  { canonicalModelKey: "wanxiang-video-2.7-1080p", displayName: "通义万相 2.7 视频 1080P", vendor: "aliyun", tierRaw: "1080P", listCostYuan: 0.68, discountRate: 0.1 },
  { canonicalModelKey: "wanxiang-t2v", displayName: "通义万相 文生视频", vendor: "aliyun", tierRaw: "标准", listCostYuan: 0.55, discountRate: 0.1 },
  { canonicalModelKey: "wanxiang-i2v", displayName: "通义万相 图生视频", vendor: "aliyun", tierRaw: "标准", listCostYuan: 0.58, discountRate: 0.1 },
  // —— 火山方舟 ——
  { canonicalModelKey: "seedance-720p", displayName: "Seedance 视频 720P", vendor: "volcengine", tierRaw: "720P", listCostYuan: 0.45, discountRate: 0.1 },
  { canonicalModelKey: "seedance-1080p", displayName: "Seedance 视频 1080P", vendor: "volcengine", tierRaw: "1080P", listCostYuan: 0.58, discountRate: 0.1 },
  { canonicalModelKey: "seedance-pro-720p", displayName: "Seedance Pro 720P", vendor: "volcengine", tierRaw: "720P", listCostYuan: 0.52, discountRate: 0.1 },
  { canonicalModelKey: "seedance-pro-1080p", displayName: "Seedance Pro 1080P", vendor: "volcengine", tierRaw: "1080P", listCostYuan: 0.65, discountRate: 0.1 },
  { canonicalModelKey: "jimeng-video", displayName: "即梦 视频生成", vendor: "volcengine", tierRaw: "标准", listCostYuan: 0.5, discountRate: 0.08 },
  { canonicalModelKey: "jimeng-video-720p", displayName: "即梦 视频 720P", vendor: "volcengine", tierRaw: "720P", listCostYuan: 0.42, discountRate: 0.08 },
  // —— KIE ——
  { canonicalModelKey: "kling-video", displayName: "可灵 视频", vendor: "kie", tierRaw: "标准", listCostYuan: 0.6, discountRate: 0.05 },
  { canonicalModelKey: "kling-video-720p", displayName: "可灵 视频 720P", vendor: "kie", tierRaw: "720P", listCostYuan: 0.48, discountRate: 0.05 },
  { canonicalModelKey: "kling-video-1080p", displayName: "可灵 视频 1080P", vendor: "kie", tierRaw: "1080P", listCostYuan: 0.72, discountRate: 0.05 },
  { canonicalModelKey: "kling-3.0-video", displayName: "可灵 3.0 视频", vendor: "kie", tierRaw: "标准", listCostYuan: 0.68, discountRate: 0.05 },
  { canonicalModelKey: "minimax-video", displayName: "MiniMax 视频", vendor: "kie", tierRaw: "标准", listCostYuan: 0.55, discountRate: 0.05 },
  { canonicalModelKey: "runway-gen3", displayName: "Runway Gen-3", vendor: "kie", tierRaw: "标准", listCostYuan: 0.75, discountRate: 0.05 },
  // —— 腾讯 ——
  { canonicalModelKey: "hunyuan-video", displayName: "混元 视频生成", vendor: "tencent", tierRaw: "标准", listCostYuan: 0.56, discountRate: 0.1 },
  { canonicalModelKey: "hunyuan-video-720p", displayName: "混元 视频 720P", vendor: "tencent", tierRaw: "720P", listCostYuan: 0.44, discountRate: 0.1 },
  { canonicalModelKey: "hunyuan-video-1080p", displayName: "混元 视频 1080P", vendor: "tencent", tierRaw: "1080P", listCostYuan: 0.6, discountRate: 0.1 },
  // —— 华为 ——
  { canonicalModelKey: "pangu-video", displayName: "盘古 视频", vendor: "huawei", tierRaw: "标准", listCostYuan: 0.54, discountRate: 0.1 },
  { canonicalModelKey: "pangu-video-720p", displayName: "盘古 视频 720P", vendor: "huawei", tierRaw: "720P", listCostYuan: 0.43, discountRate: 0.1 },
  // —— 其它 ——
  { canonicalModelKey: "luma-dream-machine", displayName: "Luma Dream Machine", vendor: "kie", tierRaw: "标准", listCostYuan: 0.7, discountRate: 0.05 },
  { canonicalModelKey: "pika-video", displayName: "Pika 视频", vendor: "kie", tierRaw: "标准", listCostYuan: 0.65, discountRate: 0.05 },
  { canonicalModelKey: "sora-compat-video", displayName: "Sora 兼容视频", vendor: "kie", tierRaw: "1080P", listCostYuan: 0.82, discountRate: 0.05 },
];
