import type { EcomDetailPageRatio } from "@/lib/detail-page-suite-platform-ratio";
import type { DetailPageSuiteBrief, DetailPageSuiteSettings } from "@/lib/detail-page-suite-types";
import {
  detailPageAspectClass,
  resolveDetailPageDisplayRatio,
} from "@/lib/detail-page-suite-platform-ratio";

/** 图 1 · 详情页模板 / 比例（单选） */
export type EcomDetailTemplateId =
  | "premium_aplus_web"
  | "premium_aplus_mobile"
  | "standard_aplus"
  | "1:1"
  | "3:4"
  | "9:16"
  | "16:9";

export type EcomDetailTemplateOption = {
  id: EcomDetailTemplateId;
  label: string;
  group: "premium" | "standard" | "ratio";
  /** 右侧展示，如 970:600 */
  sizeHint?: string;
};

export const ECOM_DETAIL_TEMPLATE_OPTIONS: EcomDetailTemplateOption[] = [
  {
    id: "premium_aplus_web",
    label: "高级A+（Web端）",
    group: "premium",
    sizeHint: "1464:600",
  },
  {
    id: "premium_aplus_mobile",
    label: "高级A+（移动端）",
    group: "premium",
    sizeHint: "600:450",
  },
  {
    id: "standard_aplus",
    label: "普通A+",
    group: "standard",
    sizeHint: "970:600",
  },
  { id: "1:1", label: "1:1", group: "ratio" },
  { id: "3:4", label: "3:4", group: "ratio" },
  { id: "9:16", label: "9:16", group: "ratio" },
  { id: "16:9", label: "16:9", group: "ratio" },
];

export const DEFAULT_ECOM_DETAIL_TEMPLATE_ID: EcomDetailTemplateId = "standard_aplus";

export function ecomDetailTemplateLabel(id: string | undefined): string {
  const opt = ECOM_DETAIL_TEMPLATE_OPTIONS.find((o) => o.id === id);
  if (!opt) return "普通A+";
  return opt.sizeHint ? `${opt.label}` : opt.label;
}

export function ecomDetailTemplateDisplayLine(id: string | undefined): string {
  const opt = ECOM_DETAIL_TEMPLATE_OPTIONS.find((o) => o.id === id);
  if (!opt) return "普通A+";
  return opt.sizeHint ? `${opt.label} · ${opt.sizeHint}` : opt.label;
}

export function detailTemplateToImageSize(id: EcomDetailTemplateId): string {
  switch (id) {
    case "premium_aplus_web":
      return "1464*600";
    case "premium_aplus_mobile":
      return "600*450";
    case "standard_aplus":
      return "970*600";
    case "1:1":
      return "1440*1440";
    case "3:4":
      return "1080*1440";
    case "9:16":
      return "810*1440";
    case "16:9":
      return "1440*810";
    default:
      return "970*600";
  }
}

export function detailTemplateToDisplayRatio(id: EcomDetailTemplateId): EcomDetailPageRatio {
  switch (id) {
    case "premium_aplus_web":
    case "standard_aplus":
    case "16:9":
      return "16:9";
    case "premium_aplus_mobile":
      return "4:5";
    case "1:1":
      return "1:1";
    case "3:4":
      return "3:4";
    case "9:16":
      return "9:16";
    default:
      return "16:9";
  }
}

export function detailTemplateAspectClass(id: EcomDetailTemplateId | string | undefined): string {
  switch (id) {
    case "premium_aplus_web":
      return "aspect-[1464/600]";
    case "premium_aplus_mobile":
      return "aspect-[600/450]";
    case "standard_aplus":
      return "aspect-[970/600]";
    case "9:16":
      return "aspect-[9/16]";
    case "16:9":
      return "aspect-[16/9]";
    case "1:1":
      return "aspect-square";
    case "3:4":
      return "aspect-[3/4]";
    default:
      return "aspect-[970/600]";
  }
}

export function resolveDetailPageRatioFromProject(
  brief: DetailPageSuiteBrief | null | undefined,
  settings: DetailPageSuiteSettings,
): EcomDetailPageRatio {
  const tpl = brief?.detailTemplateId as EcomDetailTemplateId | undefined;
  if (tpl && ECOM_DETAIL_TEMPLATE_OPTIONS.some((o) => o.id === tpl)) {
    return detailTemplateToDisplayRatio(tpl);
  }
  return resolveDetailPageDisplayRatio(brief?.platformCode, settings.imageRatio);
}

export function resolveDetailPageAspectClassFromProject(
  brief: DetailPageSuiteBrief | null | undefined,
  settings: DetailPageSuiteSettings,
): string {
  const tpl = brief?.detailTemplateId;
  if (tpl && ECOM_DETAIL_TEMPLATE_OPTIONS.some((o) => o.id === tpl)) {
    return detailTemplateAspectClass(tpl);
  }
  return detailPageAspectClass(resolveDetailPageRatioFromProject(brief, settings));
}
