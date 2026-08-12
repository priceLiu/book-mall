/**
 * 电商平台出图规则表。
 *
 * 取值为业界常见推荐值，非各平台后台实时规则；调整时同步 e-commerce-toolkit
 * 的平台选择文案，前端一律经 /product-design/platform-specs 拉取，勿在前端再写一份。
 */

export type EcomImageRatio = "1:1" | "3:4" | "4:5" | "16:9";

export type EcomPlatformSpec = {
  /** 稳定标识，落库用 */
  code: string;
  /** 用户可见名称，与 doc/ecom/pdt 的下拉选项保持一致 */
  label: string;
  mainImage: {
    recommended: number;
    min: number;
    max: number;
    ratio: EcomImageRatio;
    /** 可选比例，用户可在主图层面覆盖 */
    ratioOptions: EcomImageRatio[];
  };
  detailPage: {
    recommended: number;
    min: number;
    max: number;
    ratio: EcomImageRatio;
  };
  /** 注入 Agent prompt 的平台特性描述 */
  note: string;
};

export const ECOM_PLATFORM_SPECS: EcomPlatformSpec[] = [
  {
    code: "taobao-tmall",
    label: "淘宝/天猫",
    mainImage: {
      recommended: 5,
      min: 1,
      max: 5,
      ratio: "3:4",
      ratioOptions: ["3:4"],
    },
    detailPage: { recommended: 8, min: 6, max: 10, ratio: "3:4" },
    note: "搜索流量为主，主图推荐 3:4 竖版（无线端列表更易占屏）；详情页承担完整说服链路，允许参数与质检模块。",
  },
  {
    code: "jd",
    label: "京东",
    mainImage: {
      recommended: 6,
      min: 1,
      max: 6,
      ratio: "1:1",
      ratioOptions: ["1:1"],
    },
    detailPage: { recommended: 10, min: 8, max: 12, ratio: "3:4" },
    note: "自营调性偏理性，首图须白底或浅底、无促销角标堆叠；详情页重视规格、服务与售后凭证。",
  },
  {
    code: "pdd",
    label: "拼多多",
    mainImage: {
      recommended: 10,
      min: 1,
      max: 10,
      ratio: "1:1",
      ratioOptions: ["1:1"],
    },
    detailPage: { recommended: 8, min: 6, max: 10, ratio: "3:4" },
    note: "价格敏感人群，首图强调实惠与直观利益；详情页节奏要快，前 3 屏必须给出核心利益点。",
  },
  {
    code: "douyin",
    label: "抖音电商（抖店）",
    mainImage: {
      recommended: 5,
      min: 1,
      max: 5,
      ratio: "3:4",
      ratioOptions: ["3:4", "1:1"],
    },
    detailPage: { recommended: 6, min: 5, max: 8, ratio: "3:4" },
    note: "内容推荐流量，竖版优先，视觉需与短视频调性一致；详情页宜短，重种草与信任。",
  },
  {
    code: "kuaishou",
    label: "快手小店",
    mainImage: {
      recommended: 5,
      min: 1,
      max: 9,
      ratio: "1:1",
      ratioOptions: ["1:1", "3:4"],
    },
    detailPage: { recommended: 6, min: 5, max: 8, ratio: "3:4" },
    note: "老铁信任经济，强调真实使用场景与实拍感，避免过度精修的棚拍风。",
  },
  {
    code: "xiaohongshu",
    label: "小红书商城",
    mainImage: {
      recommended: 9,
      min: 1,
      max: 9,
      ratio: "3:4",
      ratioOptions: ["3:4", "1:1"],
    },
    detailPage: { recommended: 6, min: 4, max: 8, ratio: "3:4" },
    note: "笔记式浏览，图片即内容；生活方式与氛围感优先，慎用大字报促销风。",
  },
  {
    code: "wechat-channels",
    label: "视频号小店",
    mainImage: {
      recommended: 9,
      min: 1,
      max: 9,
      ratio: "3:4",
      ratioOptions: ["3:4", "1:1"],
    },
    detailPage: { recommended: 6, min: 5, max: 8, ratio: "3:4" },
    note: "熟人与私域转化为主，突出品质背书与售后承诺，弱化夸张促销。",
  },
  {
    code: "1688",
    label: "1688阿里巴巴批发",
    mainImage: {
      recommended: 5,
      min: 1,
      max: 5,
      ratio: "1:1",
      ratioOptions: ["1:1"],
    },
    detailPage: { recommended: 10, min: 8, max: 12, ratio: "3:4" },
    note: "面向批发买家，需给出规格矩阵、起订量、供货能力与物流方案，弱化情绪化种草。",
  },
  {
    code: "vip",
    label: "唯品会",
    mainImage: {
      recommended: 8,
      min: 1,
      max: 8,
      ratio: "1:1",
      ratioOptions: ["1:1", "3:4"],
    },
    detailPage: { recommended: 10, min: 8, max: 12, ratio: "3:4" },
    note: "特卖调性，突出品牌折扣与正品保障；详情页需完整尺码/材质/洗护信息。",
  },
  {
    code: "amazon",
    label: "亚马逊（跨境）",
    mainImage: {
      recommended: 7,
      min: 1,
      max: 7,
      ratio: "1:1",
      ratioOptions: ["1:1"],
    },
    detailPage: { recommended: 6, min: 5, max: 7, ratio: "16:9" },
    note: "首图须纯白底、产品占比 85% 以上、无文字与水印；详情按 A+ 模块横版排布，文案用英文。",
  },
  {
    code: "shopee-lazada",
    label: "Shopee/Lazada（东南亚跨境）",
    mainImage: {
      recommended: 9,
      min: 1,
      max: 9,
      ratio: "1:1",
      ratioOptions: ["1:1"],
    },
    detailPage: { recommended: 6, min: 5, max: 8, ratio: "1:1" },
    note: "移动端小屏为主，文字要少且大；注意本地化语言与当地促销习惯。",
  },
  {
    code: "independent",
    label: "独立站",
    mainImage: {
      recommended: 8,
      min: 1,
      max: 12,
      ratio: "4:5",
      ratioOptions: ["4:5", "1:1", "3:4"],
    },
    detailPage: { recommended: 8, min: 6, max: 10, ratio: "3:4" },
    note: "无平台审核约束但需自建信任，强调品牌故事、评价与退换承诺。",
  },
];

export const DEFAULT_ECOM_PLATFORM_CODE = "taobao-tmall";

export function getEcomPlatformSpec(code: string | null | undefined): EcomPlatformSpec {
  const found = ECOM_PLATFORM_SPECS.find((p) => p.code === code);
  if (found) return found;
  // 兼容按中文名传入的旧调用
  const byLabel = ECOM_PLATFORM_SPECS.find((p) => p.label === code);
  if (byLabel) return byLabel;
  return ECOM_PLATFORM_SPECS.find((p) => p.code === DEFAULT_ECOM_PLATFORM_CODE)!;
}

export type EcomPlatformCounts = {
  mainImageCount: number;
  detailPageCount: number;
  mainImageRatio: EcomImageRatio;
  detailPageRatio: EcomImageRatio;
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 越界自动兜底到平台推荐值，对应 skill_config 的「参数越界修正」但按平台判定 */
export function clampPlatformCounts(
  platformCode: string | null | undefined,
  input: {
    mainImageCount?: unknown;
    detailPageCount?: unknown;
    mainImageRatio?: unknown;
    detailPageRatio?: unknown;
  },
): EcomPlatformCounts & { spec: EcomPlatformSpec; adjusted: string[] } {
  const spec = getEcomPlatformSpec(platformCode);
  const adjusted: string[] = [];

  const mainImageCount = clampInt(
    input.mainImageCount,
    spec.mainImage.min,
    spec.mainImage.max,
    spec.mainImage.recommended,
  );
  if (input.mainImageCount != null && mainImageCount !== Number(input.mainImageCount)) {
    adjusted.push(
      `主图张数限 ${spec.mainImage.min}-${spec.mainImage.max} 张，已调整为 ${mainImageCount} 张`,
    );
  }

  const detailPageCount = clampInt(
    input.detailPageCount,
    spec.detailPage.min,
    spec.detailPage.max,
    spec.detailPage.recommended,
  );
  if (input.detailPageCount != null && detailPageCount !== Number(input.detailPageCount)) {
    adjusted.push(
      `${spec.label} 详情页限 ${spec.detailPage.min}-${spec.detailPage.max} 屏，已调整为 ${detailPageCount} 屏`,
    );
  }

  const mainImageRatio = spec.mainImage.ratioOptions.includes(
    input.mainImageRatio as EcomImageRatio,
  )
    ? (input.mainImageRatio as EcomImageRatio)
    : spec.mainImage.ratio;
  if (
    input.mainImageRatio != null &&
    input.mainImageRatio !== mainImageRatio &&
    spec.mainImage.ratioOptions.length === 1
  ) {
    adjusted.push(
      `${spec.label} 主图比例已按平台规范调整为 ${mainImageRatio}`,
    );
  }

  const detailPageRatio =
    input.detailPageRatio === "1:1" ||
    input.detailPageRatio === "3:4" ||
    input.detailPageRatio === "4:5" ||
    input.detailPageRatio === "16:9"
      ? input.detailPageRatio
      : spec.detailPage.ratio;

  return { mainImageCount, detailPageCount, mainImageRatio, detailPageRatio, spec, adjusted };
}

/** Gateway 出图尺寸：按比例给出常用长边 1440 的像素规格 */
export function ecomRatioToImageSize(ratio: EcomImageRatio): string {
  switch (ratio) {
    case "1:1":
      return "1440*1440";
    case "3:4":
      return "1080*1440";
    case "4:5":
      return "1152*1440";
    case "16:9":
      return "1440*810";
    default:
      return "1440*1440";
  }
}
