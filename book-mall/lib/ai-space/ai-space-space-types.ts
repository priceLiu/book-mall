/**
 * 我的 AI 空间 · 自由画布 DTO
 *
 * 设计见 doc/product/AI 空间功能设计文档.md。
 * 块只存指向（sourceType + sourceId），展示字段读时经 pin-resolvers 联邦解析，
 * 与 AiSpacePin 同一套规则：禁止在块上冗余 prompt / ossUrl / thumbnailUrl。
 */

import type { AiSpacePinEntry, AiSpacePinSourceType } from "./ai-space-pin-types";
import type { SpacePageTemplateKey } from "./space-blocks/page-templates";
import type { SpaceSizeTierKey } from "./space-blocks/size-tiers";
import type { SpacePageTheme } from "./space-blocks/theme";
import type { SpaceBlockType } from "./space-blocks/types";

/** 与 pin-resolvers 的 resolved 结构一致 */
export type SpaceResolvedAsset = AiSpacePinEntry["resolved"];

export type AiSpaceBlockRefDto = {
  id: string;
  sourceApp: string;
  sourceType: AiSpacePinSourceType;
  sourceId: string;
  slotKey: string;
  caption: string | null;
  sortOrder: number;
  /** 源记录已被删除时为 null，前端渲染「素材已删除」占位 */
  resolved: SpaceResolvedAsset | null;
};

export type AiSpaceBlockDto = {
  id: string;
  blockType: SpaceBlockType;
  sizeTier: SpaceSizeTierKey;
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
  layoutZ: number;
  mobileOrder: number;
  config: Record<string, unknown>;
  content: { text: string } | null;
  refs: AiSpaceBlockRefDto[];
};

export type AiSpacePageDto = {
  id: string;
  slug: string;
  title: string;
  bio: string;
  templateKey: SpacePageTemplateKey;
  theme: SpacePageTheme;
  publishStatus: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  blocks: AiSpaceBlockDto[];
};

/** 公开页视图：已剥离 launch 深链 */
export type AiSpacePublicPageDto = AiSpacePageDto & {
  ownerDisplayName: string | null;
};

/** 批量存布局的单项 */
export type AiSpaceBlockLayoutInput = {
  id: string;
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
  mobileOrder: number;
};

/** 新建块时的资产引用入参 */
export type AiSpaceBlockRefInput = {
  sourceType: AiSpacePinSourceType;
  sourceId: string;
  sourceApp?: string;
  slotKey?: string;
  caption?: string | null;
};
