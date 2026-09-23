/** 详情页套图 · 平台默认展示/出图比例（与 book-mall ecom-platform-spec 对齐） */

export type EcomDetailPageRatio = "1:1" | "3:4" | "4:5" | "16:9";

const PLATFORM_DETAIL_RATIO: Record<string, EcomDetailPageRatio> = {
  "taobao-tmall": "3:4",
  jd: "3:4",
  pdd: "3:4",
  douyin: "3:4",
  kuaishou: "3:4",
  xiaohongshu: "3:4",
  "wechat-channels": "3:4",
  "1688": "3:4",
  vip: "3:4",
  amazon: "16:9",
  "shopee-lazada": "1:1",
  independent: "3:4",
};

export function resolveDetailPageDisplayRatio(
  platformCode?: string,
  override?: string | null,
): EcomDetailPageRatio {
  if (
    override === "1:1" ||
    override === "3:4" ||
    override === "4:5" ||
    override === "16:9"
  ) {
    return override;
  }
  if (platformCode && PLATFORM_DETAIL_RATIO[platformCode]) {
    return PLATFORM_DETAIL_RATIO[platformCode]!;
  }
  return "3:4";
}

export function detailPageAspectClass(ratio: EcomDetailPageRatio): string {
  switch (ratio) {
    case "16:9":
      return "aspect-[16/9]";
    case "1:1":
      return "aspect-square";
    case "4:5":
      return "aspect-[4/5]";
    default:
      return "aspect-[3/4]";
  }
}

/** 点位格卡片宽度（容纳悬停 4 钮） */
export function detailPageCardWidth(ratio: EcomDetailPageRatio): number {
  if (ratio === "16:9") return 300;
  if (ratio === "1:1") return 200;
  return 188;
}

/** 默认 Gateway 出图尺寸（长边 1440 系） */
export function ecomRatioToDefaultImageSize(ratio: EcomDetailPageRatio): string {
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
      return "1080*1440";
  }
}

/** 详情页排版/导出默认宽（与 book-mall ecom-platform-spec widthPx 对齐） */
const PLATFORM_DETAIL_WIDTH_PX: Record<string, number> = {
  "taobao-tmall": 750,
  jd: 790,
  pdd: 750,
  douyin: 750,
  kuaishou: 750,
  xiaohongshu: 750,
  "wechat-channels": 750,
  "1688": 750,
  vip: 750,
  amazon: 1464,
  "shopee-lazada": 800,
  independent: 1080,
};

export function resolveDetailPageExportWidthPx(platformCode?: string | null): number {
  if (platformCode && PLATFORM_DETAIL_WIDTH_PX[platformCode]) {
    return PLATFORM_DETAIL_WIDTH_PX[platformCode]!;
  }
  return 750;
}

export function detailPageRatioLabel(ratio: EcomDetailPageRatio, platformCode?: string): string {
  const platform = platformCode ? PLATFORM_DETAIL_RATIO[platformCode] : undefined;
  if (platform && platform === ratio) {
    return `${ratio}（平台默认）`;
  }
  return ratio;
}
