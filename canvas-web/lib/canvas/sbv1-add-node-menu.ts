import type { Pro2AddMenuSection } from "./pro2-add-node-menu";
import { SBV1_VIDEO_COMPOSE_LABEL } from "./sbv1-node-chrome";
import {
  Image as ImageIcon,
  Sparkles,
  Type,
  Video,
  Wand2,
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

/** 图片节点右侧 + · 视频合成（自动连线 in_ref） */
export const SBV1_IMAGE_RIGHT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "引用该节点生成",
    items: [
      {
        id: "video-compose",
        label: SBV1_VIDEO_COMPOSE_LABEL,
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
    ],
  },
];

/** 视频合成左侧 + · 添加上游参考（自动连线 in_ref） */
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
      { id: "video", label: "视频", icon: Video, enabled: false },
      { id: "text", label: "文本", icon: Type, enabled: false },
    ],
  },
];

/** 视频合成右侧 + · 串联下一节点 */
export const SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "串联生成",
    items: [
      {
        id: "video-compose",
        label: SBV1_VIDEO_COMPOSE_LABEL,
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
    ],
  },
];

/** 分组右侧 + · 接入视频合成 */
export const SBV1_GROUP_RIGHT_ADD_MENU: Pro2AddMenuSection[] = [
  {
    title: "引用组内图片",
    items: [
      {
        id: "video-compose",
        label: SBV1_VIDEO_COMPOSE_LABEL,
        icon: Video,
        enabled: true,
        nodeType: "sbv1-video-engine",
      },
    ],
  },
];
