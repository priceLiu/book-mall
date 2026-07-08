import type { Pro2AddMenuSection } from "./pro2-add-node-menu";
import { SBV1_VIDEO_COMPOSE_LABEL } from "./sbv1-node-chrome";
import {
  Clapperboard,
  Download,
  Image as ImageIcon,
  ScanLine,
  Sparkles,
  Type,
  Video,
  Wand2,
  Box,
} from "lucide-react";

/** 图片节点左侧 + · 文生图 / 图生图 */
export const SBV1_IMAGE_LEFT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "生成图片",
    items: [
      {
        id: "txt2img",
        label: "文生图",
        icon: Wand2,
        enabled: true,
        nodeType: "sbv1-image",
      },
      {
        id: "img2img",
        label: "图生图",
        icon: Sparkles,
        enabled: true,
        nodeType: "sbv1-image",
      },
    ],
  },
];

/** 图片节点右侧 + · 视频（自动连线 in_ref） */
export const SBV1_IMAGE_RIGHT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "引用该节点生成",
    items: [
      {
        id: "video",
        label: SBV1_VIDEO_COMPOSE_LABEL,
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
    ],
  },
];

/** 视频节点左侧 + · 添加上游参考（自动连线 in_ref） */
export const SBV1_VIDEO_ENGINE_LEFT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "添加上下文",
    items: [
      {
        id: "image",
        label: "图片",
        icon: ImageIcon,
        enabled: true,
        nodeType: "sbv1-image",
      },
      { id: "video", label: "动作视频", icon: Video, enabled: true, nodeType: "sbv1-video-engine" },
      {
        id: "text",
        label: "文本",
        icon: Type,
        enabled: true,
        nodeType: "story-pro2-starter",
      },
      {
        id: "style-asset",
        label: "素材",
        icon: Box,
        enabled: true,
        nodeType: "story-pro2-style-asset",
      },
    ],
  },
];

/** 导出剪辑节点右侧 + · 自动成片 */
export const JIANYING_EXPORT_RIGHT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "导出成片",
    items: [
      {
        id: "auto-render",
        label: "自动成片",
        icon: Clapperboard,
        enabled: true,
        nodeType: "jianying-auto-render-pro2",
      },
    ],
  },
];

/** 自动成片节点左侧 + · 接入视频 */
export const JIANYING_AUTO_RENDER_LEFT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "接入视频",
    items: [
      {
        id: "video",
        label: "视频",
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
    ],
  },
];

/** 导出剪辑节点左侧 + · 接入视频 */
export const JIANYING_EXPORT_LEFT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "接入视频",
    items: [
      {
        id: "video",
        label: "视频",
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
    ],
  },
];

/** 视频节点右侧 + · 串联下一节点 / 导出剪辑 */
export const SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "串联生成",
    items: [
      {
        id: "hd-video",
        label: "高清视频",
        icon: ScanLine,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
      {
        id: "video",
        label: SBV1_VIDEO_COMPOSE_LABEL,
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
    ],
  },
  {
    title: "导出成片",
    items: [
      {
        id: "auto-render",
        label: "自动成片",
        icon: Clapperboard,
        enabled: true,
        nodeType: "jianying-auto-render-pro2",
      },
      {
        id: "export",
        label: "导出剪辑",
        icon: Download,
        enabled: true,
        nodeType: "jianying-export-pro2",
      },
    ],
  },
];

/** 分组右侧 + · 接入视频 */
export const SBV1_GROUP_RIGHT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "引用组内图片",
    items: [
      {
        id: "video",
        label: SBV1_VIDEO_COMPOSE_LABEL,
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
    ],
  },
];
