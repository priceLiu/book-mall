import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  FileText,
  FileUp,
  Film,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Link2,
  Music,
  Scissors,
  Sparkles,
  Type,
  User,
  Video,
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
  /** 悬停/点击展开二级菜单（如素材库 → 风格库） */
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
    id: "video",
    label: "视频",
    icon: Video,
    enabled: true,
  },
  {
    id: "video-compose",
    label: "视频合成",
    icon: Scissors,
    enabled: true,
    badge: "Beta",
  },
  {
    id: "director",
    label: "导演台",
    icon: Layers,
    enabled: true,
    badge: "NEW",
  },
  { id: "audio", label: "音频", icon: Music, enabled: true },
  {
    id: "script",
    label: "脚本",
    icon: FileText,
    enabled: true,
    badge: "Beta",
    nodeType: "story-pro2-script-hub",
  },
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
      { id: "video", label: "视频", icon: Video, enabled: true },
      {
        id: "video-compose",
        label: "视频合成",
        icon: Scissors,
        enabled: true,
        badge: "Beta",
      },
      {
        id: "director",
        label: "导演台",
        icon: Layers,
        enabled: false,
        badge: "NEW",
      },
      { id: "audio", label: "音频", icon: Music, enabled: false },
      {
        id: "script",
        label: "脚本",
        icon: FileText,
        enabled: false,
        badge: "NEW",
      },
      {
        id: "upload-script",
        label: "上传剧本",
        icon: FileUp,
        enabled: true,
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
      { id: "video", label: "视频", icon: Video, enabled: false },
      {
        id: "video-compose",
        label: "视频合成",
        icon: Scissors,
        enabled: false,
        badge: "Beta",
      },
      {
        id: "director",
        label: "导演台",
        icon: Layers,
        enabled: false,
        badge: "NEW",
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

/** 素材库二级菜单 */
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
        label: "素材库",
        icon: Boxes,
        enabled: true,
        badge: "NEW",
        submenu: PRO2_ASSET_LIB_SUBMENU,
      },
    ],
  },
  {
    title: "添加资源",
    items: [
      { id: "upload", label: "上传", icon: ImageIcon, enabled: true },
      { id: "history", label: "从生成历史选择", icon: Film, enabled: true },
    ],
  },
];
