import { newOverlayLayerId, type EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";

import { IMAGE_EDITOR_POSTER_EM, type SellingPosterModel } from "@/lib/image-editor-poster-pieces";
import { IMAGE_EDITOR_SELLING_POSTER_SRCS } from "@/lib/image-editor-selling-posters";
import { applyImageEditorFlower } from "@/lib/image-editor-text-flower";
import {
  IMAGE_EDITOR_TEXT_PLACEHOLDER,
  removeImageEditorTextLayer,
  type ImageEditorTextDocument,
  type ImageEditorTextLayerExtras,
} from "@/lib/image-editor-text";

export type ImageEditorTextTemplateKind =
  | "title"
  | "banner"
  | "gold"
  | "body"
  | "mark"
  | "selling"
  | "pill"
  | "stamp"
  | "bubble"
  | "burst"
  | "frame"
  | "coil"
  | "ribbon";

export type ImageEditorSellingMark = "vip" | "checks" | "num" | "dot" | "star" | "line";

export type ImageEditorTextTemplate = {
  id: string;
  category: string;
  label: string;
  kind: ImageEditorTextTemplateKind;
  sample: string;
  color: string;
  bg?: string;
  mark?: ImageEditorSellingMark;
  /** 行首标记颜色。卖点全表用它区分红勾、蓝编号等 */
  markColor?: string;
  /** 本地卖点贴纸。全表缩略图和画布都用这张图 */
  poster?: string;
};

const SHAPE_KINDS = new Set<ImageEditorTextTemplateKind>(["stamp", "bubble", "burst", "frame", "coil", "ribbon"]);

export function isImageEditorShapeKind(kind: string | undefined): kind is ImageEditorTextTemplateKind {
  return !!kind && SHAPE_KINDS.has(kind as ImageEditorTextTemplateKind);
}

export const IMAGE_EDITOR_TEXT_TEMPLATE_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "latest", label: "最新素材" },
  { id: "basic", label: "基础样式" },
  { id: "selling", label: "商品卖点" },
  { id: "recommend", label: "好物推荐" },
  { id: "daily", label: "日常" },
  { id: "ecom", label: "电商" },
  { id: "note", label: "标注" },
  { id: "stamp", label: "印章水印" },
  { id: "live", label: "直播" },
  { id: "bubble", label: "气泡框" },
  { id: "coil", label: "简约线圈" },
  { id: "checkin", label: "打卡" },
  { id: "frame", label: "标题框" },
  { id: "burst", label: "爆炸贴" },
  { id: "badge", label: "按钮角标" },
  { id: "promo", label: "营销宣传" },
  { id: "notice", label: "通知提醒" },
  { id: "en", label: "英文排版" },
  { id: "logo", label: "店招logo" },
  { id: "menu", label: "清单菜单" },
  { id: "china", label: "中国风" },
  { id: "cross", label: "跨境电商" },
  { id: "bless", label: "祝福" },
  { id: "time", label: "时间节点" },
  { id: "coupon", label: "优惠券" },
];

function item(
  id: string,
  category: string,
  label: string,
  kind: ImageEditorTextTemplateKind,
  sample: string,
  color: string,
  bg?: string,
  mark?: ImageEditorSellingMark,
  markColor?: string,
): ImageEditorTextTemplate {
  return { id, category, label, kind, sample, color, bg, mark, markColor };
}

function sellingPosterCatalog(): ImageEditorTextTemplate[] {
  return IMAGE_EDITOR_SELLING_POSTER_SRCS.map((poster, index) => ({
    id: `selling-poster-${index + 1}`,
    category: "selling",
    label: `商品卖点 ${index + 1}`,
    kind: "selling" as const,
    sample: "商品卖点",
    color: "#1d1d1f",
    poster,
  }));
}

export const IMAGE_EDITOR_TEXT_TEMPLATES: ImageEditorTextTemplate[] = [
  item("latest-banner", "latest", "新品上架", "banner", "新品上架", "#ffffff", "#e5484d"),
  item("latest-burst", "latest", "限时", "burst", "限时", "#ffffff", "#ff5a1f"),
  item("latest-bubble", "latest", "推荐", "bubble", "推荐", "#1d1d1f", "#fff4d6"),
  item("latest-stamp", "latest", "正品", "stamp", "正品", "#e5484d"),

  item("title-plain", "basic", "大标题", "title", "标题文字", "#1d1d1f"),
  item("title-banner", "basic", "红底标题", "banner", "标题文字", "#ffffff", "#e5484d"),
  item("title-gold", "basic", "金色标题", "gold", "标题文字", "#f0b429"),
  item("body-plain", "basic", "说明正文", "body", "说明文字", "#3a322c"),
  item("body-mark", "basic", "划线正文", "mark", "划重点", "#1d1d1f"),
  item("basic-frame", "basic", "线框标题", "frame", "标题文字", "#1d1d1f"),

  ...sellingPosterCatalog(),

  item("rec-heart", "recommend", "好物", "pill", "好物", "#ffffff", "#e5484d"),
  item("rec-star", "recommend", "必买", "burst", "必买", "#ffffff", "#f0a04a"),
  item("rec-bubble", "recommend", "种草", "bubble", "种草", "#1d1d1f", "#ffe8d6"),
  item("rec-ribbon", "recommend", "推荐", "ribbon", "推荐", "#ffffff", "#e23b2f"),

  item("daily-hello", "daily", "你好", "title", "你好", "#1d1d1f"),
  item("daily-note", "daily", "今日份", "body", "今日份", "#3a322c"),
  item("daily-coil", "daily", "日常", "coil", "日常", "#3a322c"),
  item("daily-mark", "daily", "记录", "mark", "记录一下", "#1d1d1f"),

  item("ecom-sale", "ecom", "促销", "burst", "促销", "#ffffff", "#e5484d"),
  item("ecom-off", "ecom", "折扣", "ribbon", "5折", "#ffffff", "#c2410c"),
  item("ecom-shop", "ecom", "店铺", "pill", "进店", "#ffffff", "#1d1d1f"),
  item("ecom-hot", "ecom", "热卖章", "stamp", "热卖", "#e5484d"),

  item("note-arrow", "note", "看这里", "pill", "看这里", "#ffffff", "#3d7eff"),
  item("note-circle", "note", "重点", "coil", "重点", "#e5484d"),
  item("note-box", "note", "标注框", "frame", "标注", "#1d1d1f"),
  item("note-line", "note", "划线", "mark", "划线标注", "#1d1d1f"),

  item("stamp-ok", "stamp", "已验", "stamp", "已验", "#1f8f4e"),
  item("stamp-sale", "stamp", "促销章", "stamp", "促销", "#e5484d"),
  item("stamp-new", "stamp", "新品章", "stamp", "新品", "#c2410c"),
  item("stamp-hot", "stamp", "热卖章", "stamp", "热卖", "#e5484d"),

  item("live-on", "live", "直播", "pill", "直播", "#ffffff", "#e5484d"),
  item("live-now", "live", "直播中", "burst", "直播中", "#ffffff", "#ff2d55"),
  item("live-gift", "live", "礼物", "ribbon", "礼物", "#ffffff", "#f0a04a"),
  item("live-hi", "live", "欢迎", "bubble", "欢迎", "#1d1d1f", "#ffffff"),

  item("bubble-round", "bubble", "圆气泡", "bubble", "你好", "#1d1d1f", "#ffffff"),
  item("bubble-think", "bubble", "浅气泡", "bubble", "想一想", "#3a322c", "#f4f1ea"),
  item("bubble-sale", "bubble", "特价气泡", "bubble", "特价", "#ffffff", "#e5484d"),
  item("bubble-soft", "bubble", "提示气泡", "bubble", "提示", "#1d4e89", "#e8f1ff"),

  item("coil-title", "coil", "线圈标题", "coil", "标题", "#1d1d1f"),
  item("coil-note", "coil", "线圈备注", "coil", "备注", "#3a322c"),
  item("coil-sale", "coil", "线圈促销", "coil", "SALE", "#e5484d"),
  item("coil-new", "coil", "线圈新品", "coil", "NEW", "#1f8f4e"),

  item("check-day", "checkin", "打卡章", "stamp", "打卡", "#e5484d"),
  item("check-ok", "checkin", "已打卡", "pill", "已打卡", "#ffffff", "#1f8f4e"),
  item("check-go", "checkin", "去打卡", "burst", "打卡", "#ffffff", "#f0a04a"),
  item("check-note", "checkin", "第1天", "frame", "第1天", "#1d1d1f"),

  item("frame-line", "frame", "线框", "frame", "标题", "#1d1d1f"),
  item("frame-gold", "frame", "金框", "frame", "标题", "#a16207"),
  item("frame-red", "frame", "红框", "frame", "标题", "#e5484d"),
  item("frame-blue", "frame", "蓝框", "frame", "标题", "#1d4e89"),

  item("burst-sale", "burst", "爆款", "burst", "爆款", "#ffffff", "#e5484d"),
  item("burst-hot", "burst", "热", "burst", "HOT", "#ffffff", "#ff5a1f"),
  item("burst-off", "burst", "折扣贴", "burst", "5折", "#ffffff", "#f0a04a"),
  item("burst-new", "burst", "上新贴", "burst", "NEW", "#ffffff", "#1f8f4e"),

  item("tag-hot", "badge", "热卖", "pill", "热卖", "#ffffff", "#e5484d"),
  item("tag-new", "badge", "新品", "pill", "新品", "#ffffff", "#1f8f4e"),
  item("tag-price", "badge", "价格", "pill", "¥99", "#c2410c", "#fff4d6"),
  item("tag-vip", "badge", "会员", "pill", "VIP", "#ffffff", "#f0a04a"),

  item("promo-go", "promo", "立即抢", "banner", "立即抢", "#ffffff", "#e5484d"),
  item("promo-limit", "promo", "限量", "burst", "限量", "#ffffff", "#c2410c"),
  item("promo-free", "promo", "包邮", "ribbon", "包邮", "#ffffff", "#1f8f4e"),
  item("promo-off", "promo", "满减", "title", "满减", "#e5484d"),

  item("notice-new", "notice", "通知", "pill", "通知", "#ffffff", "#3d7eff"),
  item("notice-warn", "notice", "注意", "burst", "注意", "#ffffff", "#f0a04a"),
  item("notice-box", "notice", "提醒框", "frame", "提醒", "#1d4e89"),
  item("notice-bubble", "notice", "消息", "bubble", "消息", "#1d1d1f", "#fff4d6"),

  item("en-sale", "en", "SALE", "title", "SALE", "#1d1d1f"),
  item("en-new", "en", "NEW", "banner", "NEW", "#ffffff", "#1d1d1f"),
  item("en-hot", "en", "HOT", "gold", "HOT", "#f0b429"),
  item("en-off", "en", "OFF", "burst", "OFF", "#ffffff", "#e5484d"),

  item("logo-shop", "logo", "店名", "frame", "店名", "#1d1d1f"),
  item("logo-mark", "logo", "品牌章", "stamp", "品牌", "#c2410c"),
  item("logo-en", "logo", "SHOP", "title", "SHOP", "#1d1d1f"),
  item("logo-pill", "logo", "旗舰店", "pill", "旗舰店", "#ffffff", "#1d1d1f"),

  item("menu-frame", "menu", "菜单框", "frame", "菜单", "#1d1d1f"),
  item("menu-body", "menu", "今日菜单", "body", "今日菜单", "#3a322c"),
  item("menu-pill", "menu", "必点", "pill", "必点", "#ffffff", "#e5484d"),
  item("menu-coil", "menu", "招牌", "coil", "招牌", "#c2410c"),

  item("cn-title", "china", "国风标题", "title", "中国风", "#a16207"),
  item("cn-frame", "china", "国风框", "frame", "国风", "#8b1e1e"),
  item("cn-stamp", "china", "福章", "stamp", "福", "#e5484d"),
  item("cn-gold", "china", "雅金", "gold", "雅", "#f0b429"),

  item("cross-sale", "cross", "SALE", "title", "SALE", "#1d1d1f"),
  item("cross-off", "cross", "折扣", "burst", "50%", "#ffffff", "#e5484d"),
  item("cross-new", "cross", "NEW", "banner", "NEW", "#ffffff", "#111111"),
  item("cross-free", "cross", "FREE", "pill", "FREE", "#ffffff", "#1f8f4e"),

  item("bless-fu", "bless", "福", "stamp", "福", "#e5484d"),
  item("bless-hi", "bless", "恭喜", "title", "恭喜", "#c2410c"),
  item("bless-gold", "bless", "吉祥", "gold", "吉祥", "#f0b429"),
  item("bless-bubble", "bless", "祝福", "bubble", "祝福", "#8b1e1e", "#fff4d6"),

  item("time-618", "time", "618", "burst", "618", "#ffffff", "#e5484d"),
  item("time-11", "time", "双11", "pill", "双11", "#ffffff", "#e5484d"),
  item("time-year", "time", "新年", "title", "新年", "#c2410c"),
  item("time-clock", "time", "限时", "frame", "限时", "#1d1d1f"),

  item("coupon-off", "coupon", "满减券", "ribbon", "满减", "#ffffff", "#e5484d"),
  item("coupon-5", "coupon", "折扣券", "burst", "5折", "#ffffff", "#f0a04a"),
  item("coupon-get", "coupon", "领券", "pill", "领券", "#ffffff", "#e5484d"),
  item("coupon-frame", "coupon", "券框", "frame", "优惠券", "#e5484d"),
];

const TEMPLATE_BY_ID = new Map(IMAGE_EDITOR_TEXT_TEMPLATES.map((template) => [template.id, template]));

export function imageEditorTextTemplateById(id: string | undefined): ImageEditorTextTemplate | null {
  if (!id) return null;
  return TEMPLATE_BY_ID.get(id) ?? null;
}

const KIND_SCALE: Record<ImageEditorTextTemplateKind, number> = {
  title: 1,
  banner: 0.78,
  gold: 0.9,
  body: 0.42,
  mark: 0.48,
  selling: 0.42,
  pill: 0.46,
  stamp: 0.52,
  bubble: 0.5,
  burst: 0.46,
  frame: 0.62,
  coil: 0.5,
  ribbon: 0.52,
};

function fontPx(exportW: number, exportH: number, scale: number): number {
  const base = Math.max(exportW, exportH);
  return Math.round(Math.max(22, Math.min(160, base * 0.096 * scale)));
}

/** 卖点按原图位置放成一组：色块、勾、文字。文字可以双击编辑。 */
export function placeImageEditorPosterGroup(
  doc: ImageEditorTextDocument,
  input: {
    sample: string;
    model: SellingPosterModel;
    exportW: number;
    exportH: number;
    posterId?: string;
  },
): { doc: ImageEditorTextDocument; layerId: string; layerIds: string[] } {
  const rows = input.model.rows.filter((row) => row.w > 0 && row.h > 0);
  if (!rows.length || input.model.imgW < 2) return { doc, layerId: "", layerIds: [] };
  const groupId = `grp-${Math.random().toString(36).slice(2, 10)}`;
  const fontSize = fontPx(input.exportW, input.exportH, 0.9);
  const fullW = IMAGE_EDITOR_POSTER_EM * fontSize;
  const scale = fullW / input.model.imgW;
  const nx0 = 0.5 - fullW / 2 / Math.max(1, input.exportW);
  const ny0 = 0.4;
  const nxOf = (x: number) => nx0 + (x * scale) / Math.max(1, input.exportW);
  const nyOf = (y: number) => ny0 + (y * scale) / Math.max(1, input.exportH);
  const emOf = (px: number) => (px * scale) / Math.max(1, fontSize);
  let next = doc;
  const layerIds: string[] = [];
  let textId = "";
  const add = (
    text: string,
    color: string,
    x: number,
    y: number,
    extras: ImageEditorTextLayerExtras,
  ) => {
    const id = newOverlayLayerId(next.overlay);
    layerIds.push(id);
    next = push(
      next,
      {
        id,
        text,
        nx: nxOf(x),
        ny: nyOf(y),
        fontSize,
        color,
        fontWeight: "bold",
        fontFamily: "yahei",
        textAlign: "left",
        maxWidthNorm: 0.9,
        maxHeightNorm: 0.9,
        writingMode: "horizontal",
      },
      {
        ...extras,
        groupId,
        grouped: true,
        layout: "h-left",
        ...(input.posterId
          ? { sellingPosterId: input.posterId, posterPlaceNx: nx0, posterPlaceNy: ny0 }
          : {}),
      },
    ).doc;
    return id;
  };
  for (const row of rows) {
    if (row.bar) {
      add("\u00a0", row.barColor, row.x, row.y, {
        shapeKind: "bar",
        shapeColor: row.barColor,
        shapeBg: row.pill ? "pill" : "round",
        markW: emOf(row.w),
        markH: emOf(row.h),
      });
    }
    if (row.icon?.src) {
      add("\u00a0", row.textColor, row.icon.x, row.icon.y, {
        posterSrc: row.icon.src,
        posterWidthEm: emOf(row.icon.w),
        posterHeightEm: emOf(row.icon.h),
      });
    }
    const textHeight = row.h * 0.5;
    const textX = row.icon ? row.icon.x + row.icon.w + row.h * 0.18 : row.x + row.w * 0.22;
    const textY = row.y + (row.h - textHeight) / 2;
    const id = add(input.sample, row.textColor, textX, textY, {});
    if (!textId) textId = id;
  }
  return { doc: next, layerId: textId || layerIds[0] || "", layerIds };
}

/** 先按原图摆上一整张，字和图形都与素材一致。取消组合时再按这张原图拆层。 */
export function placeOriginalSellingPoster(
  doc: ImageEditorTextDocument,
  input: {
    src: string;
    imgW: number;
    imgH: number;
    exportW: number;
    exportH: number;
    posterId?: string;
  },
): { doc: ImageEditorTextDocument; layerId: string; layerIds: string[] } {
  if (input.imgW < 2 || input.imgH < 2) return { doc, layerId: "", layerIds: [] };
  const groupId = `grp-${Math.random().toString(36).slice(2, 10)}`;
  const fontSize = fontPx(input.exportW, input.exportH, 0.9);
  const fullW = IMAGE_EDITOR_POSTER_EM * fontSize;
  const nx0 = 0.5 - fullW / 2 / Math.max(1, input.exportW);
  const ny0 = 0.4;
  const id = newOverlayLayerId(doc.overlay);
  const placed = push(
    doc,
    {
      id,
      text: "\u00a0",
      nx: nx0,
      ny: ny0,
      fontSize,
      color: "#1d1d1f",
      fontWeight: "bold",
      fontFamily: "yahei",
      textAlign: "left",
      maxWidthNorm: 0.9,
      maxHeightNorm: 0.9,
      writingMode: "horizontal",
    },
    {
      groupId,
      grouped: true,
      layout: "h-left",
      posterSrc: input.src,
      posterWidthEm: IMAGE_EDITOR_POSTER_EM,
      posterHeightEm: IMAGE_EDITOR_POSTER_EM * (input.imgH / input.imgW),
      ...(input.posterId
        ? { sellingPosterId: input.posterId, posterPlaceNx: nx0, posterPlaceNy: ny0 }
        : {}),
    },
  );
  return { doc: placed.doc, layerId: id, layerIds: [id] };
}

export type SellingPosterDecomposeLayer = {
  role: "background" | "block" | "mark" | "text";
  url: string;
  text: string;
  color?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 用入库的拆层换掉当前这一组，并取消组合。位置仍铺在原来的贴纸左上角。 */
export function replaceSellingGroupWithDecompose(
  doc: ImageEditorTextDocument,
  input: {
    groupId: string;
    sample: string;
    imgW: number;
    imgH: number;
    layers: SellingPosterDecomposeLayer[];
    exportW: number;
    exportH: number;
  },
): { doc: ImageEditorTextDocument; layerId: string; layerIds: string[] } {
  const members = doc.overlay.layers.filter((layer) => doc.extras[layer.id]?.groupId === input.groupId);
  if (!members.length || !input.layers.length || input.imgW < 2) {
    return { doc, layerId: "", layerIds: [] };
  }
  const anchor = doc.extras[members[0]!.id];
  const fontSize = members[0]!.fontSize;
  const originNx = anchor?.posterPlaceNx ?? Math.min(...members.map((layer) => layer.nx));
  const originNy = anchor?.posterPlaceNy ?? Math.min(...members.map((layer) => layer.ny));
  const posterId = anchor?.sellingPosterId;
  const drop = new Set(members.map((layer) => layer.id));
  const extras = { ...doc.extras };
  for (const id of drop) delete extras[id];
  let next: ImageEditorTextDocument = {
    overlay: { ...doc.overlay, layers: doc.overlay.layers.filter((layer) => !drop.has(layer.id)) },
    extras,
  };
  const fullW = IMAGE_EDITOR_POSTER_EM * fontSize;
  const spanH = (input.imgH / input.imgW) * fullW;
  const layerIds: string[] = [];
  let textId = "";
  const ordered = [...input.layers].sort((a, b) => {
    const az = a.role === "background" ? -1 : 0;
    const bz = b.role === "background" ? -1 : 0;
    return az - bz;
  });
  for (const piece of ordered) {
    const id = newOverlayLayerId(next.overlay);
    layerIds.push(id);
    const isGlyph = piece.role === "text" || piece.role === "mark";
    const boxW = piece.w * fullW;
    const boxH = piece.h * spanH;
    const font = piece.role === "mark" ? Math.max(8, boxH * 0.72) : piece.role === "text" ? Math.max(8, boxH * 0.92) : fontSize;
    let nx = originNx + (piece.x * fullW) / Math.max(1, input.exportW);
    let ny = originNy + (piece.y * spanH) / Math.max(1, input.exportH);
    if (piece.role === "text" || piece.role === "mark") {
      ny += (boxH - font) / 2 / Math.max(1, input.exportH);
    }
    if (piece.role === "mark") {
      nx += (boxW - font) / 2 / Math.max(1, input.exportW);
    }
    const text = isGlyph ? piece.text || input.sample : "\u00a0";
    if (piece.role === "text" && !textId) textId = id;
    next = push(
      next,
      {
        id,
        text,
        nx,
        ny,
        fontSize: font,
        color: piece.color || (piece.role === "mark" ? "#ffffff" : "#1d1d1f"),
        fontWeight: "bold",
        fontFamily: "yahei",
        textAlign: "left",
        maxWidthNorm: 0.9,
        maxHeightNorm: 0.9,
        writingMode: "horizontal",
      },
      {
        groupId: input.groupId,
        grouped: false,
        layout: "h-left",
        lineHeight: 100,
        ...(posterId ? { sellingPosterId: posterId } : {}),
        sellingDecomposed: true,
        posterPlaceNx: originNx,
        posterPlaceNy: originNy,
        ...(isGlyph
          ? {}
          : {
              posterSrc: piece.url,
              posterWidthEm: piece.w * IMAGE_EDITOR_POSTER_EM,
              posterHeightEm: piece.h * IMAGE_EDITOR_POSTER_EM * (input.imgH / input.imgW),
            }),
      },
    ).doc;
  }
  return { doc: next, layerId: textId || layerIds[0] || "", layerIds };
}

function push(
  doc: ImageEditorTextDocument,
  layer: EcomCopyOverlayLayer,
  extras: ImageEditorTextLayerExtras,
): { doc: ImageEditorTextDocument; layerId: string } {
  return {
    doc: {
      overlay: { ...doc.overlay, layers: [...doc.overlay.layers, layer] },
      extras: { ...doc.extras, [layer.id]: extras },
    },
    layerId: layer.id,
  };
}

export function isDecorTemplateKind(kind: string | undefined): boolean {
  return kind === "banner" || kind === "pill" || isImageEditorShapeKind(kind);
}

function createDecorGroup(
  doc: ImageEditorTextDocument,
  found: ImageEditorTextTemplate,
  exportW: number,
  exportH: number,
): { doc: ImageEditorTextDocument; layerId: string } {
  const groupId = `grp-${Math.random().toString(36).slice(2, 10)}`;
  const fontSize = fontPx(exportW, exportH, KIND_SCALE[found.kind]);
  const nx = 0.5;
  const ny = 0.42;
  const decorId = newOverlayLayerId(doc.overlay);
  const decor = push(
    doc,
    {
      id: decorId,
      text: "\u00a0",
      nx,
      ny,
      fontSize,
      color: found.bg || found.color,
      fontWeight: "bold",
      fontFamily: "yahei",
      textAlign: "center",
      maxWidthNorm: 0.8,
      maxHeightNorm: 0.6,
      writingMode: "horizontal",
    },
    {
      templateId: found.id,
      groupId,
      grouped: true,
      role: "decor",
      shapeKind: found.kind,
      shapeColor: found.color,
      shapeBg: found.bg,
    },
  );
  const labelId = newOverlayLayerId(decor.doc.overlay);
  const label = push(
    decor.doc,
    {
      id: labelId,
      text: found.sample,
      nx,
      ny,
      fontSize,
      color: found.color,
      fontWeight: "bold",
      fontFamily: "yahei",
      textAlign: "center",
      maxWidthNorm: 0.8,
      maxHeightNorm: 0.6,
      writingMode: "horizontal",
    },
    {
      templateId: found.id,
      groupId,
      grouped: true,
      role: "label",
    },
  );
  return { doc: label.doc, layerId: labelId };
}

export function expandLegacyDecorGroups(doc: ImageEditorTextDocument): {
  doc: ImageEditorTextDocument;
  replaced: Record<string, string>;
} {
  const replaced: Record<string, string> = {};
  const targets = doc.overlay.layers.filter((layer) => {
    const extras = doc.extras[layer.id];
    if (extras?.groupId || extras?.role) return false;
    const template = imageEditorTextTemplateById(extras?.templateId);
    return Boolean(template && isDecorTemplateKind(template.kind));
  });
  if (!targets.length) return { doc, replaced };
  let next = doc;
  for (const layer of targets) {
    const extras = next.extras[layer.id] ?? {};
    const template = imageEditorTextTemplateById(extras.templateId);
    if (!template) continue;
    const groupId = `grp-${Math.random().toString(36).slice(2, 10)}`;
    next = removeImageEditorTextLayer(next, layer.id);
    const decorId = newOverlayLayerId(next.overlay);
    const decor = push(
      next,
      {
        ...layer,
        id: decorId,
        text: "\u00a0",
        textAlign: "center",
        color: template.bg || template.color,
      },
      {
        role: "decor",
        shapeKind: template.kind,
        shapeColor: template.color,
        shapeBg: template.bg,
        templateId: template.id,
        groupId,
        grouped: true,
      },
    );
    const labelId = newOverlayLayerId(decor.doc.overlay);
    next = push(
      decor.doc,
      {
        ...layer,
        id: labelId,
        text: layer.text.trim() ? layer.text : template.sample,
        textAlign: "center",
        color: layer.color || template.color,
        textBgEnabled: false,
      },
      {
        role: "label",
        templateId: template.id,
        groupId,
        grouped: true,
      },
    ).doc;
    replaced[layer.id] = labelId;
  }
  return { doc: next, replaced };
}

function createSellingGroup(
  doc: ImageEditorTextDocument,
  found: ImageEditorTextTemplate,
  exportW: number,
  exportH: number,
): { doc: ImageEditorTextDocument; layerId: string } {
  const groupId = `grp-${Math.random().toString(36).slice(2, 10)}`;
  const fontSize = fontPx(exportW, exportH, KIND_SCALE.selling);
  const step = (fontSize * 1.45) / Math.max(1, exportH);
  const nx = 0.22;
  const startNy = 0.34;
  let next = doc;
  let firstId = "";
  for (let index = 0; index < 3; index += 1) {
    const id = newOverlayLayerId(next.overlay);
    if (!firstId) firstId = id;
    const layer: EcomCopyOverlayLayer = {
      id,
      text: "商品卖点",
      nx,
      ny: startNy + index * step,
      fontSize,
      color: found.color,
      fontWeight: "bold",
      fontFamily: "yahei",
      textAlign: "left",
      maxWidthNorm: 0.8,
      maxHeightNorm: 0.2,
      writingMode: "horizontal",
    };
    const extras: ImageEditorTextLayerExtras = {
      templateId: found.id,
      groupId,
      grouped: true,
      mark: found.mark ?? "checks",
      markColor: found.markColor,
      lineHeight: 120,
      layout: "h-left",
    };
    next = push(next, layer, extras).doc;
  }
  return { doc: next, layerId: firstId };
}

/** 旧的整卡卖点（多行写在一个图层里）拆成可组合的三行。 */
export function expandLegacySellingGroups(
  doc: ImageEditorTextDocument,
  exportH: number,
): { doc: ImageEditorTextDocument; replaced: Record<string, string> } {
  const replaced: Record<string, string> = {};
  const targets = doc.overlay.layers.filter((layer) => {
    const extras = doc.extras[layer.id];
    const template = imageEditorTextTemplateById(extras?.templateId);
    return template?.kind === "selling" && !extras?.groupId && layer.text.includes("\n");
  });
  if (!targets.length) return { doc, replaced };
  let next = doc;
  for (const layer of targets) {
    const extras = next.extras[layer.id] ?? {};
    const template = imageEditorTextTemplateById(extras.templateId);
    const lines = layer.text.split("\n").filter((line) => line.length > 0).slice(0, 6);
    const groupId = `grp-${Math.random().toString(36).slice(2, 10)}`;
    const step = (layer.fontSize * 1.45) / Math.max(1, exportH);
    next = removeImageEditorTextLayer(next, layer.id);
    let first = "";
    lines.forEach((text, index) => {
      const id = newOverlayLayerId(next.overlay);
      if (!first) first = id;
      const placed = push(
        next,
        {
          ...layer,
          id,
          text,
          textAlign: "left",
          ny: Math.max(0, Math.min(1, layer.ny + index * step)),
        },
        {
          ...extras,
          templateId: extras.templateId,
          groupId,
          grouped: true,
          mark: template?.mark ?? "checks",
          markColor: template?.markColor,
          layout: "h-left",
        },
      );
      next = placed.doc;
    });
    if (first) replaced[layer.id] = first;
  }
  return { doc: next, replaced };
}

export function createImageEditorTextFromTemplate(
  doc: ImageEditorTextDocument,
  templateId: string,
  exportW: number,
  exportH: number,
): { doc: ImageEditorTextDocument; layerId: string } {
  const id = newOverlayLayerId(doc.overlay);
  const found = imageEditorTextTemplateById(templateId);
  const base: EcomCopyOverlayLayer = {
    id,
    text: IMAGE_EDITOR_TEXT_PLACEHOLDER,
    nx: 0.5,
    ny: 0.46,
    fontSize: fontPx(exportW, exportH, 0.72),
    color: "#1d1d1f",
    fontWeight: "bold",
    fontFamily: "yahei",
    textAlign: "center",
    maxWidthNorm: 0.8,
    maxHeightNorm: 0.6,
    writingMode: "horizontal",
  };
  if (!found) return push(doc, base, {});
  if (found.poster) {
    const layer: EcomCopyOverlayLayer = {
      ...base,
      text: found.sample,
      nx: 0.5,
      ny: 0.4,
      fontSize: fontPx(exportW, exportH, 0.9),
      textAlign: "center",
    };
    return push(doc, layer, { posterSrc: found.poster, templateId: found.id });
  }
  if (found.kind === "selling") return createSellingGroup(doc, found, exportW, exportH);
  if (isDecorTemplateKind(found.kind)) return createDecorGroup(doc, found, exportW, exportH);

  const shaped = false;
  const pill = false;
  const layer: EcomCopyOverlayLayer = {
    ...base,
    text: found.sample,
    color: found.color,
    fontSize: fontPx(exportW, exportH, KIND_SCALE[found.kind]),
    fontWeight: found.kind === "body" ? "normal" : "bold",
    textAlign: found.kind === "body" ? "left" : "center",
    ny: found.kind === "body" ? 0.58 : 0.46,
    textBgEnabled: pill && Boolean(found.bg),
    textBgColor: found.bg,
    textBgOpacity: pill ? 1 : undefined,
    textBgPaddingPx: found.kind === "banner" ? 18 : found.kind === "pill" ? 14 : undefined,
    textBgRadiusPx: found.kind === "banner" ? 14 : found.kind === "pill" ? 999 : undefined,
  };
  const extras: ImageEditorTextLayerExtras = {};
  if (shaped) extras.templateId = found.id;
  if (found.kind === "body") extras.lineHeight = 150;
  if (found.kind === "mark") {
    extras.highlightId = "marker";
    extras.highlightColor = "#f7c948";
  }
  if (found.kind === "gold") {
    const placed = push(doc, layer, extras);
    return { doc: applyImageEditorFlower(placed.doc, placed.layerId, "honey"), layerId: placed.layerId };
  }
  return push(doc, layer, extras);
}
