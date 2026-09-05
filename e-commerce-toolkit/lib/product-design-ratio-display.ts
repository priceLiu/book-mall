/** 电商产品创作 · 平台出图比例展示（卡片 / 预览框） */

export function productDesignRatioClass(ratio: string): string {
  switch (ratio) {
    case "3:4":
      return "aspect-[3/4]";
    case "4:5":
      return "aspect-[4/5]";
    case "16:9":
      return "aspect-video";
    default:
      return "aspect-square";
  }
}

export function productDesignCssAspectRatio(ratio: string): string {
  switch (ratio) {
    case "3:4":
      return "3 / 4";
    case "4:5":
      return "4 / 5";
    case "16:9":
      return "16 / 9";
    case "9:16":
      return "9 / 16";
    default:
      return "1 / 1";
  }
}

/** 卡片内图片区：固定 3:4（等平台比例）容器，图片完整显示不裁切 */
export function productDesignRatioFrameClass(ratio: string): string {
  return [
    "relative w-full shrink-0 overflow-hidden bg-white",
    productDesignRatioClass(ratio),
  ].join(" ");
}
