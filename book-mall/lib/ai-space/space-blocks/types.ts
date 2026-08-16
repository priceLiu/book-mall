/**
 * 作品墙自由画布 · 挂件类型与配置
 *
 * 设计见 doc/product/AI 空间功能设计文档.md §5。
 * 本文件为 **纯数据 / 纯逻辑**（无 React），服务端校验与客户端渲染共用；
 * 挂件的 View / Inspector 组件在 components/ai-space/space-blocks/renderers.tsx 映射。
 */

import type { AiSpacePinMediaKind } from "../ai-space-pin-types";
import type { SpaceSizeTierKey } from "./size-tiers";

export const SPACE_BLOCK_TYPES = [
  // 资产型
  "image",
  "video",
  "audio",
  "gallery",
  "before_after",
  "character_card",
  "video_playlist",
  // 装饰 / 功能型
  "heading",
  "text",
  "divider_spacer",
  "profile_card",
  "launch_button",
] as const;

export type SpaceBlockType = (typeof SPACE_BLOCK_TYPES)[number];

export function isSpaceBlockType(v: unknown): v is SpaceBlockType {
  return (
    typeof v === "string" && (SPACE_BLOCK_TYPES as readonly string[]).includes(v)
  );
}

// ---------------------------------------------------------------------------
// 解析工具（config / content 一律走白名单，未知字段丢弃）
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function asObj(raw: unknown): Obj {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Obj)
    : {};
}

function pickString(raw: unknown, fallback: string, maxLen = 200): string {
  if (typeof raw !== "string") return fallback;
  return raw.slice(0, maxLen);
}

function pickBool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

function pickInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? Math.round(raw) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pickEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

// ---------------------------------------------------------------------------
// 各挂件配置
// ---------------------------------------------------------------------------

/** 所有块共享：块内小标题与外框 */
export type SpaceFrameConfig = {
  title: string;
  framed: boolean;
};

function parseFrame(raw: Obj): SpaceFrameConfig {
  return {
    title: pickString(raw.title, "", 120),
    framed: pickBool(raw.framed, true),
  };
}

export const MEDIA_FITS = ["cover", "contain"] as const;
export const ALIGNS = ["left", "center", "right"] as const;

export type SpaceImageConfig = SpaceFrameConfig & {
  fit: (typeof MEDIA_FITS)[number];
  showCaption: boolean;
};

export type SpaceVideoConfig = SpaceFrameConfig & {
  fit: (typeof MEDIA_FITS)[number];
  loop: boolean;
  muted: boolean;
  /** 仅静音时生效，公开页也遵守 */
  autoplay: boolean;
};

export type SpaceAudioConfig = SpaceFrameConfig & {
  showScript: boolean;
};

export const GALLERY_LAYOUTS = ["grid", "masonry", "carousel"] as const;
export const GAP_SIZES = ["sm", "md", "lg"] as const;

export type SpaceGalleryConfig = SpaceFrameConfig & {
  layout: (typeof GALLERY_LAYOUTS)[number];
  columns: number;
  gap: (typeof GAP_SIZES)[number];
  showCaptions: boolean;
};

export type SpaceBeforeAfterConfig = SpaceFrameConfig & {
  labelBefore: string;
  labelAfter: string;
  /** 初始分割线位置（百分比） */
  initialPercent: number;
};

export type SpaceCharacterCardConfig = SpaceFrameConfig & {
  name: string;
  role: string;
  showSlotLabels: boolean;
};

export type SpaceVideoPlaylistConfig = SpaceFrameConfig & {
  showTitles: boolean;
};

export type SpaceHeadingConfig = SpaceFrameConfig & {
  level: number;
  align: (typeof ALIGNS)[number];
};

export const TEXT_SIZES = ["sm", "md", "lg"] as const;

export type SpaceTextConfig = SpaceFrameConfig & {
  align: (typeof ALIGNS)[number];
  size: (typeof TEXT_SIZES)[number];
};

export const DIVIDER_VARIANTS = ["line", "dashed", "dots", "space"] as const;

export type SpaceDividerConfig = SpaceFrameConfig & {
  variant: (typeof DIVIDER_VARIANTS)[number];
};

export type SpaceProfileLink = { label: string; url: string };

export type SpaceProfileCardConfig = SpaceFrameConfig & {
  align: (typeof ALIGNS)[number];
  showAvatar: boolean;
  links: SpaceProfileLink[];
};

export const BUTTON_VARIANTS = ["primary", "outline"] as const;

export type SpaceLaunchButtonConfig = SpaceFrameConfig & {
  label: string;
  note: string;
  variant: (typeof BUTTON_VARIANTS)[number];
};

export type SpaceBlockConfigMap = {
  image: SpaceImageConfig;
  video: SpaceVideoConfig;
  audio: SpaceAudioConfig;
  gallery: SpaceGalleryConfig;
  before_after: SpaceBeforeAfterConfig;
  character_card: SpaceCharacterCardConfig;
  video_playlist: SpaceVideoPlaylistConfig;
  heading: SpaceHeadingConfig;
  text: SpaceTextConfig;
  divider_spacer: SpaceDividerConfig;
  profile_card: SpaceProfileCardConfig;
  launch_button: SpaceLaunchButtonConfig;
};

export type SpaceBlockConfig = SpaceBlockConfigMap[SpaceBlockType];

/** 纯内容型挂件的正文（heading / text） */
export type SpaceBlockContent = { text: string };

// ---------------------------------------------------------------------------
// 挂件定义
// ---------------------------------------------------------------------------

export type SpaceBlockSlot = { key: string; label: string };

export type SpaceBlockDef<K extends SpaceBlockType = SpaceBlockType> = {
  type: K;
  label: string;
  group: "asset" | "widget";
  description: string;
  /** 可引用资产数量范围；装饰型为 { min: 0, max: 0 } */
  refs: { min: number; max: number };
  /** 可接受的媒体形态；不限制则不填 */
  acceptKinds?: AiSpacePinMediaKind[];
  /** 命名槽位（前后对比、角色卡） */
  slots?: SpaceBlockSlot[];
  allowedTiers: SpaceSizeTierKey[];
  defaultTier: SpaceSizeTierKey;
  /** 档位只控宽度时用于夹紧高度 */
  maxH?: number;
  parseConfig(raw: unknown): SpaceBlockConfigMap[K];
  /** 有正文的挂件返回 { text }，其余返回 null */
  parseContent(raw: unknown): SpaceBlockContent | null;
};

const noContent = () => null;

const IMAGE_TIERS: SpaceSizeTierKey[] = ["sm", "portrait", "wide", "lg", "full"];

export const SPACE_BLOCKS: { [K in SpaceBlockType]: SpaceBlockDef<K> } = {
  image: {
    type: "image",
    label: "单图卡",
    group: "asset",
    description: "展示一张作品图",
    refs: { min: 1, max: 1 },
    acceptKinds: ["image"],
    allowedTiers: IMAGE_TIERS,
    defaultTier: "lg",
    parseConfig(raw) {
      const o = asObj(raw);
      return {
        ...parseFrame(o),
        fit: pickEnum(o.fit, MEDIA_FITS, "cover"),
        showCaption: pickBool(o.showCaption, true),
      };
    },
    parseContent: noContent,
  },

  video: {
    type: "video",
    label: "视频播放器",
    group: "asset",
    description: "单条视频，进视口才加载",
    refs: { min: 1, max: 1 },
    acceptKinds: ["video"],
    allowedTiers: IMAGE_TIERS,
    defaultTier: "lg",
    parseConfig(raw) {
      const o = asObj(raw);
      const muted = pickBool(o.muted, true);
      return {
        ...parseFrame(o),
        fit: pickEnum(o.fit, MEDIA_FITS, "contain"),
        loop: pickBool(o.loop, false),
        muted,
        // 浏览器禁止带声自动播放，未静音时强制关闭
        autoplay: muted ? pickBool(o.autoplay, false) : false,
      };
    },
    parseContent: noContent,
  },

  audio: {
    type: "audio",
    label: "音频播放器",
    group: "asset",
    description: "口播 / 配乐，可显示台词",
    refs: { min: 1, max: 1 },
    acceptKinds: ["audio"],
    allowedTiers: ["sm", "wide", "lg", "full"],
    defaultTier: "wide",
    maxH: 4,
    parseConfig(raw) {
      const o = asObj(raw);
      return { ...parseFrame(o), showScript: pickBool(o.showScript, false) };
    },
    parseContent: noContent,
  },

  gallery: {
    type: "gallery",
    label: "图片墙",
    group: "asset",
    description: "多图网格 / 瀑布流 / 轮播",
    refs: { min: 1, max: 60 },
    acceptKinds: ["image"],
    allowedTiers: ["wide", "lg", "full"],
    defaultTier: "full",
    parseConfig(raw) {
      const o = asObj(raw);
      return {
        ...parseFrame(o),
        layout: pickEnum(o.layout, GALLERY_LAYOUTS, "grid"),
        columns: pickInt(o.columns, 3, 2, 6),
        gap: pickEnum(o.gap, GAP_SIZES, "md"),
        showCaptions: pickBool(o.showCaptions, false),
      };
    },
    parseContent: noContent,
  },

  before_after: {
    type: "before_after",
    label: "前后对比",
    group: "asset",
    description: "两图滑动对比：试衣、精修、修图",
    refs: { min: 2, max: 2 },
    acceptKinds: ["image"],
    slots: [
      { key: "before", label: "改前" },
      { key: "after", label: "改后" },
    ],
    allowedTiers: ["wide", "lg", "full"],
    defaultTier: "lg",
    parseConfig(raw) {
      const o = asObj(raw);
      return {
        ...parseFrame(o),
        labelBefore: pickString(o.labelBefore, "改前", 20),
        labelAfter: pickString(o.labelAfter, "改后", 20),
        initialPercent: pickInt(o.initialPercent, 50, 0, 100),
      };
    },
    parseContent: noContent,
  },

  character_card: {
    type: "character_card",
    label: "角色卡",
    group: "asset",
    description: "多槽位形象展示：脸 / 全身 / 服装",
    refs: { min: 1, max: 4 },
    acceptKinds: ["image"],
    slots: [
      { key: "face", label: "面部" },
      { key: "full_body", label: "全身" },
      { key: "outfit", label: "服装" },
      { key: "extra", label: "补充" },
    ],
    allowedTiers: ["portrait", "wide", "lg", "full"],
    defaultTier: "lg",
    parseConfig(raw) {
      const o = asObj(raw);
      return {
        ...parseFrame(o),
        name: pickString(o.name, "", 60),
        role: pickString(o.role, "", 60),
        showSlotLabels: pickBool(o.showSlotLabels, true),
      };
    },
    parseContent: noContent,
  },

  video_playlist: {
    type: "video_playlist",
    label: "视频合集",
    group: "asset",
    description: "多条视频，缩略图切换播放",
    refs: { min: 1, max: 20 },
    acceptKinds: ["video"],
    allowedTiers: ["lg", "full"],
    defaultTier: "full",
    parseConfig(raw) {
      const o = asObj(raw);
      return { ...parseFrame(o), showTitles: pickBool(o.showTitles, true) };
    },
    parseContent: noContent,
  },

  heading: {
    type: "heading",
    label: "标题",
    group: "widget",
    description: "分区标题",
    refs: { min: 0, max: 0 },
    allowedTiers: ["sm", "wide", "lg", "full"],
    defaultTier: "full",
    maxH: 2,
    parseConfig(raw) {
      const o = asObj(raw);
      return {
        ...parseFrame(o),
        framed: pickBool(o.framed, false),
        level: pickInt(o.level, 2, 1, 3),
        align: pickEnum(o.align, ALIGNS, "left"),
      };
    },
    parseContent(raw) {
      return { text: pickString(asObj(raw).text, "新标题", 120) };
    },
  },

  text: {
    type: "text",
    label: "文字",
    group: "widget",
    description: "纯文本段落（不支持 HTML）",
    refs: { min: 0, max: 0 },
    allowedTiers: ["sm", "portrait", "wide", "lg", "full"],
    defaultTier: "wide",
    parseConfig(raw) {
      const o = asObj(raw);
      return {
        ...parseFrame(o),
        align: pickEnum(o.align, ALIGNS, "left"),
        size: pickEnum(o.size, TEXT_SIZES, "md"),
      };
    },
    parseContent(raw) {
      return { text: pickString(asObj(raw).text, "", 2000) };
    },
  },

  divider_spacer: {
    type: "divider_spacer",
    label: "分隔线 / 留白",
    group: "widget",
    description: "分区骨架",
    refs: { min: 0, max: 0 },
    allowedTiers: ["sm", "wide", "lg", "full"],
    defaultTier: "full",
    maxH: 2,
    parseConfig(raw) {
      const o = asObj(raw);
      return {
        ...parseFrame(o),
        framed: pickBool(o.framed, false),
        variant: pickEnum(o.variant, DIVIDER_VARIANTS, "line"),
      };
    },
    parseContent: noContent,
  },

  profile_card: {
    type: "profile_card",
    label: "个人名片",
    group: "widget",
    description: "头像 + 空间标题 + 简介 + 链接",
    refs: { min: 0, max: 1 },
    acceptKinds: ["image"],
    allowedTiers: ["portrait", "wide", "lg", "full"],
    defaultTier: "wide",
    parseConfig(raw) {
      const o = asObj(raw);
      const rawLinks = Array.isArray(o.links) ? o.links.slice(0, 6) : [];
      const links: SpaceProfileLink[] = [];
      for (const item of rawLinks) {
        const l = asObj(item);
        const url = pickString(l.url, "", 300);
        // 只放行 http(s)，避免公开页出现 javascript: 伪协议
        if (!/^https?:\/\//i.test(url)) continue;
        links.push({ label: pickString(l.label, url, 40), url });
      }
      return {
        ...parseFrame(o),
        align: pickEnum(o.align, ALIGNS, "left"),
        showAvatar: pickBool(o.showAvatar, true),
        links,
      };
    },
    parseContent: noContent,
  },

  launch_button: {
    type: "launch_button",
    label: "继续创作按钮",
    group: "widget",
    description: "深链回源应用继续编辑（公开页不显示）",
    refs: { min: 1, max: 1 },
    allowedTiers: ["sm", "wide"],
    defaultTier: "sm",
    maxH: 3,
    parseConfig(raw) {
      const o = asObj(raw);
      return {
        ...parseFrame(o),
        label: pickString(o.label, "继续创作", 30),
        note: pickString(o.note, "", 80),
        variant: pickEnum(o.variant, BUTTON_VARIANTS, "outline"),
      };
    },
    parseContent: noContent,
  },
};

export const SPACE_BLOCK_LIST: SpaceBlockDef[] = SPACE_BLOCK_TYPES.map(
  (t) => SPACE_BLOCKS[t] as SpaceBlockDef,
);

export function getSpaceBlockDef(type: string): SpaceBlockDef | null {
  return isSpaceBlockType(type) ? (SPACE_BLOCKS[type] as SpaceBlockDef) : null;
}

/** 单页总 refs 上限，避免一页解析上千条资产 */
export const SPACE_PAGE_MAX_BLOCKS = 60;
export const SPACE_PAGE_MAX_REFS = 500;
