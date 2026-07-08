import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Box,
  Clapperboard,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Music,
  Palette,
  ScanLine,
  Sparkles,
  Tag,
  Type,
  User,
  Video,
  Wind,
} from "lucide-react";

export type Pro2AddMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** 为 false 时置灰且不可点（仅保留未开放能力） */
  enabled: boolean;
  badge?: "Beta" | "NEW";
  /** 点击后创建/连接的节点 type */
  nodeType?: string;
  /** 悬停/点击展开二级菜单（如资产库 → 风格库） */
  submenu?: Pro2AddMenuSection[];
};

export type Pro2AddMenuSection = {
  title?: string;
  items: Pro2AddMenuItem[];
};

const NODE_ITEMS: Pro2AddMenuItem[] = [
  {
    id: "text",
    label: "文本",
    icon: Type,
    enabled: true,
    nodeType: "story-pro2-starter",
  },
  {
    id: "tag",
    label: "标签",
    icon: Tag,
    enabled: true,
    nodeType: "story-pro2-tag",
  },
  {
    id: "image",
    label: "图片",
    icon: ImageIcon,
    enabled: true,
    nodeType: "story-pro2-image",
  },
  {
    id: "three-view",
    label: "三视图",
    icon: User,
    enabled: true,
    nodeType: "story-pro2-three-view",
  },
  {
    id: "hd-video",
    label: "高清视频",
    icon: ScanLine,
    enabled: true,
    nodeType: "sbv1-video-engine",
  },
  {
    id: "video",
    label: "视频",
    icon: Video,
    enabled: true,
    nodeType: "sbv1-video-engine",
  },
  { id: "audio", label: "音频", icon: Music, enabled: true, nodeType: "story-pro2-audio" },
  {
    id: "script",
    label: "脚本",
    icon: FileText,
    enabled: true,
    badge: "Beta",
    nodeType: "story-pro2-script-hub",
  },
];

/** 2.0 · 工作环节（Rail / Dock 工作环节区） */
const PRO2_EXPORT_ITEM: Pro2AddMenuItem = {
  id: "export",
  label: "导出剪辑",
  icon: Download,
  enabled: true,
  nodeType: "jianying-export-pro2",
};

const PRO2_AUTO_RENDER_ITEM: Pro2AddMenuItem = {
  id: "auto-render",
  label: "自动成片",
  icon: Clapperboard,
  enabled: true,
  nodeType: "jianying-auto-render-pro2",
};

const PRO2_STAGE_ITEMS: Pro2AddMenuItem[] = [
  {
    id: "character-column",
    label: "人物设计",
    icon: User,
    enabled: true,
    nodeType: "story-pro2-three-view",
  },
  PRO2_EXPORT_ITEM,
  PRO2_AUTO_RENDER_ITEM,
];

/** 图片 / 三视图节点左侧 + · 添加上游输入（文生图：接文本） */
export const PRO2_IMAGE_LEFT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "添加上下文",
    items: [
      {
        id: "text",
        label: "文本",
        icon: Type,
        enabled: true,
        nodeType: "story-pro2-starter",
      },
      {
        id: "image",
        label: "图片",
        icon: ImageIcon,
        enabled: true,
        nodeType: "story-pro2-image",
      },
      {
        id: "style-asset",
        label: "风格图",
        icon: Box,
        enabled: true,
        nodeType: "story-pro2-style-asset",
      },
      { id: "video", label: "视频", icon: Video, enabled: false },
      {
        id: "script",
        label: "脚本",
        icon: FileText,
        enabled: false,
        badge: "Beta",
      },
    ],
  },
];

/** 文本节点左侧 + · 添加上下文（未开放项置灰，见设计稿） */
export const PRO2_STARTER_LEFT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "添加上下文",
    items: [
      {
        id: "text",
        label: "文本",
        icon: Type,
        enabled: true,
        nodeType: "story-pro2-starter",
      },
      {
        id: "image",
        label: "图片",
        icon: ImageIcon,
        enabled: true,
        nodeType: "story-pro2-image",
      },
      {
        id: "video",
        label: "视频",
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
      { id: "audio", label: "音频", icon: Music, enabled: false },
      {
        id: "script",
        label: "脚本",
        icon: FileText,
        enabled: false,
        badge: "NEW",
      },
      { id: "ref-node", label: "参考节点", icon: Link2, enabled: true },
    ],
  },
];

/** @deprecated 文本节点请用 {@link PRO2_STARTER_LEFT_ADD_MENU} */
export const PRO2_LEFT_ADD_MENU = PRO2_STARTER_LEFT_ADD_MENU;

/** 风格素材节点右侧 + · 仅文本、图片可连出（见图 4） */
export const PRO2_STYLE_ASSET_RIGHT_MENU: Pro2AddMenuSection[] = [
  {
    title: "引用该节点生成",
    items: [
      {
        id: "text",
        label: "文本",
        icon: Type,
        enabled: true,
        nodeType: "story-pro2-starter",
      },
      {
        id: "image",
        label: "图片",
        icon: ImageIcon,
        enabled: true,
        nodeType: "story-pro2-image",
      },
      {
        id: "video",
        label: "视频",
        icon: Video,
        enabled: false,
        nodeType: "sbv1-video-engine",
      },
      { id: "audio", label: "音频", icon: Music, enabled: false },
      {
        id: "script",
        label: "脚本",
        icon: FileText,
        enabled: false,
        badge: "NEW",
      },
      { id: "ref-node", label: "参考节点", icon: Link2, enabled: false },
    ],
  },
];

/** 资产库二级菜单 */
export const PRO2_ASSET_LIB_SUBMENU: Pro2AddMenuSection[] = [
  {
    items: [
      {
        id: "style-library",
        label: "风格库",
        icon: LayoutGrid,
        enabled: true,
      },
      {
        id: "fx-library",
        label: "特效库",
        icon: Sparkles,
        enabled: false,
      },
      {
        id: "prop-column",
        label: "道具设计",
        icon: Box,
        enabled: true,
        badge: "NEW",
        nodeType: "story-pro2-prop",
      },
      {
        id: "mood-column",
        label: "氛围设计",
        icon: Wind,
        enabled: true,
        badge: "NEW",
        nodeType: "story-pro2-mood",
      },
      {
        id: "audio-column",
        label: "音效设计",
        icon: Music,
        enabled: true,
        badge: "NEW",
        nodeType: "story-pro2-audio",
      },
      {
        id: "scene-column",
        label: "场景设计",
        icon: LayoutGrid,
        enabled: true,
        nodeType: "story-pro2-image",
      },
    ],
  },
];

/** 节点右侧 + · 引用该节点生成 */
export const PRO2_RIGHT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "引用该节点生成",
    items: [
      ...NODE_ITEMS,
      { id: "ref-node", label: "参考节点", icon: Link2, enabled: true },
    ],
  },
];

/** 底部工具栏 + · 添加节点 / 资源 */
export const PRO2_TOOLBAR_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "添加节点",
    items: [
      ...NODE_ITEMS,
      {
        id: "asset-lib",
        label: "资产库",
        icon: Boxes,
        enabled: true,
        badge: "NEW",
        submenu: PRO2_ASSET_LIB_SUBMENU,
      },
    ],
  },
  {
    title: "工作环节",
    items: PRO2_STAGE_ITEMS,
  },
  {
    title: "添加资源",
    items: [
      { id: "upload", label: "上传", icon: ImageIcon, enabled: true },
      { id: "history", label: "从生成历史选择", icon: Film, enabled: true },
    ],
  },
];

/** 左侧竖向 Rail · 点击在视口中心生成对应环节节点 */
export const PRO2_STAGE_RAIL_ITEMS: Pro2AddMenuItem[] = [
  {
    id: "script",
    label: "故事剧本",
    icon: FileText,
    enabled: true,
    nodeType: "story-pro2-script-hub",
  },
  {
    id: "style-library",
    label: "风格定义",
    icon: Palette,
    enabled: true,
  },
  ...PRO2_STAGE_ITEMS,
];
