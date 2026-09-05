/**
 * 作品墙自由画布 · 五套整页版式模板
 *
 * 设计见 doc/product/AI 空间功能设计文档.md §4。
 * 模板给出「骨架」：块类型 + 档位 + 栅格坐标；需要资产的块以空槽位落地，
 * 用户从素材抽屉拖资产进去即可。套用模板不删除任何已有块。
 */

import {
  resolveTierLayout,
  type SpaceSizeTierKey,
} from "./size-tiers";
import { SPACE_BLOCKS, type SpaceBlockType } from "./types";

/** 与 Prisma enum AiSpacePageTemplate 取值一致 */
export const SPACE_PAGE_TEMPLATE_KEYS = [
  "MAGAZINE",
  "PORTFOLIO",
  "BENTO",
  "TIMELINE",
  "MINIMAL",
] as const;

export type SpacePageTemplateKey = (typeof SPACE_PAGE_TEMPLATE_KEYS)[number];

export function isSpacePageTemplateKey(v: unknown): v is SpacePageTemplateKey {
  return (
    typeof v === "string" &&
    (SPACE_PAGE_TEMPLATE_KEYS as readonly string[]).includes(v)
  );
}

export type SpaceTemplateBlock = {
  blockType: SpaceBlockType;
  sizeTier: SpaceSizeTierKey;
  x: number;
  y: number;
  config?: Record<string, unknown>;
  content?: { text: string };
};

export type SpacePageTemplateDef = {
  key: SpacePageTemplateKey;
  label: string;
  description: string;
  /** 一句话说明适合什么内容 */
  bestFor: string;
  blocks: SpaceTemplateBlock[];
};

const TEMPLATES: Record<SpacePageTemplateKey, SpacePageTemplateDef> = {
  MAGAZINE: {
    key: "MAGAZINE",
    label: "杂志封面",
    description: "顶部通栏封面大图 + 标题，下方图文左右交替",
    bestFor: "主打单件作品",
    blocks: [
      { blockType: "image", sizeTier: "full", x: 0, y: 0 },
      {
        blockType: "heading",
        sizeTier: "full",
        x: 0,
        y: 6,
        config: { level: 1, align: "center" },
        content: { text: "作品标题" },
      },
      {
        blockType: "text",
        sizeTier: "wide",
        x: 0,
        y: 8,
        content: { text: "写下这件作品的创作思路。" },
      },
      { blockType: "image", sizeTier: "lg", x: 6, y: 8 },
      { blockType: "image", sizeTier: "lg", x: 0, y: 11 },
      {
        blockType: "text",
        sizeTier: "wide",
        x: 6,
        y: 14,
        content: { text: "补充说明或制作参数。" },
      },
    ],
  },

  PORTFOLIO: {
    key: "PORTFOLIO",
    label: "作品集网格",
    description: "名片条 + 通栏图片墙 + 四列缩略卡",
    bestFor: "大量作品平铺",
    blocks: [
      { blockType: "profile_card", sizeTier: "wide", x: 0, y: 0 },
      {
        blockType: "text",
        sizeTier: "wide",
        x: 6,
        y: 0,
        content: { text: "一句话介绍你的创作方向。" },
      },
      {
        blockType: "heading",
        sizeTier: "full",
        x: 0,
        y: 3,
        content: { text: "精选作品" },
      },
      {
        blockType: "gallery",
        sizeTier: "full",
        x: 0,
        y: 5,
        config: { layout: "grid", columns: 4 },
      },
      {
        blockType: "heading",
        sizeTier: "full",
        x: 0,
        y: 11,
        content: { text: "更多" },
      },
      { blockType: "image", sizeTier: "sm", x: 0, y: 13 },
      { blockType: "image", sizeTier: "sm", x: 3, y: 13 },
      { blockType: "image", sizeTier: "sm", x: 6, y: 13 },
      { blockType: "image", sizeTier: "sm", x: 9, y: 13 },
    ],
  },

  BENTO: {
    key: "BENTO",
    label: "拼贴",
    description: "通栏主视觉 + 大小块错落拼贴",
    bestFor: "图片、视频、音频混合",
    blocks: [
      { blockType: "image", sizeTier: "full", x: 0, y: 0 },
      { blockType: "image", sizeTier: "portrait", x: 0, y: 6 },
      { blockType: "video", sizeTier: "lg", x: 3, y: 6 },
      { blockType: "image", sizeTier: "sm", x: 9, y: 6 },
      { blockType: "audio", sizeTier: "sm", x: 9, y: 9 },
      {
        blockType: "heading",
        sizeTier: "full",
        x: 0,
        y: 12,
        content: { text: "作品合集" },
      },
      {
        blockType: "gallery",
        sizeTier: "full",
        x: 0,
        y: 14,
        config: { layout: "masonry", columns: 4 },
      },
    ],
  },

  TIMELINE: {
    key: "TIMELINE",
    label: "时间线",
    description: "单列纵向，每段「日期 + 作品 + 说明」",
    bestFor: "创作历程",
    blocks: [
      {
        blockType: "heading",
        sizeTier: "full",
        x: 0,
        y: 0,
        config: { level: 1 },
        content: { text: "创作历程" },
      },
      {
        blockType: "heading",
        sizeTier: "sm",
        x: 0,
        y: 2,
        config: { level: 3 },
        content: { text: "2026 · 春" },
      },
      { blockType: "image", sizeTier: "lg", x: 0, y: 4 },
      {
        blockType: "text",
        sizeTier: "wide",
        x: 6,
        y: 4,
        content: { text: "这一阶段在尝试什么。" },
      },
      {
        blockType: "heading",
        sizeTier: "sm",
        x: 0,
        y: 10,
        config: { level: 3 },
        content: { text: "2026 · 夏" },
      },
      { blockType: "image", sizeTier: "lg", x: 0, y: 12 },
      {
        blockType: "text",
        sizeTier: "wide",
        x: 6,
        y: 12,
        content: { text: "后续的变化与收获。" },
      },
    ],
  },

  MINIMAL: {
    key: "MINIMAL",
    label: "极简单栏",
    description: "居中窄栏、大留白，只放少量精选",
    bestFor: "个人名片页",
    blocks: [
      { blockType: "profile_card", sizeTier: "wide", x: 3, y: 0 },
      {
        blockType: "divider_spacer",
        sizeTier: "wide",
        x: 3,
        y: 3,
        config: { variant: "line" },
      },
      { blockType: "image", sizeTier: "lg", x: 3, y: 5 },
      {
        blockType: "text",
        sizeTier: "wide",
        x: 3,
        y: 11,
        content: { text: "关于这件作品。" },
      },
      { blockType: "image", sizeTier: "lg", x: 3, y: 14 },
    ],
  },
};

export const SPACE_PAGE_TEMPLATES = TEMPLATES;

export const SPACE_PAGE_TEMPLATE_LIST: SpacePageTemplateDef[] =
  SPACE_PAGE_TEMPLATE_KEYS.map((k) => TEMPLATES[k]);

export function getSpacePageTemplate(
  key: SpacePageTemplateKey,
): SpacePageTemplateDef {
  return TEMPLATES[key];
}

export type ResolvedTemplateBlock = {
  blockType: SpaceBlockType;
  sizeTier: SpaceSizeTierKey;
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
  mobileOrder: number;
  config: Record<string, unknown>;
  content: { text: string } | null;
  /** 需要用户填资产的槽位（refs.min > 0） */
  needsAsset: boolean;
};

/** 把模板展开为可直接落库的块，宽高由档位（受 maxH 夹紧）推导 */
export function buildTemplateBlocks(
  key: SpacePageTemplateKey,
): ResolvedTemplateBlock[] {
  const tpl = TEMPLATES[key];
  return tpl.blocks.map((b, i) => {
    const def = SPACE_BLOCKS[b.blockType];
    const { w, h } = resolveTierLayout(b.sizeTier, def.maxH);
    return {
      blockType: b.blockType,
      sizeTier: b.sizeTier,
      layoutX: b.x,
      layoutY: b.y,
      layoutW: w,
      layoutH: h,
      mobileOrder: i,
      config: def.parseConfig(b.config ?? {}) as Record<string, unknown>,
      content: def.parseContent(b.content ?? {}),
      needsAsset: def.refs.min > 0,
    };
  });
}
