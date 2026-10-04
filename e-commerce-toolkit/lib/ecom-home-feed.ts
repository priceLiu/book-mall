import type { LucideIcon } from "lucide-react";
import { FileImage, Film, Package, Sparkles } from "lucide-react";

export type EcomHomeFeaturedCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

/** 公开首页四宫格（点击进入对应工作台，生成时再登录）。 */
export const ECOM_HOME_FEATURED_CARDS: EcomHomeFeaturedCard[] = [
  {
    id: "product-creation",
    title: "电商产品主图",
    description: "卖点策略 + 主图文案与配图，一键出图",
    href: "/ecom/product-creation",
    icon: Package,
  },
  {
    id: "detail-page-creation",
    title: "详情长图分屏创作",
    description: "架构 + 分屏文案 · 助手 Step · 可接主图策略",
    href: "/ecom/detail-page-creation",
    icon: FileImage,
  },
  {
    id: "seed-video",
    title: "种草短视频",
    description: "素材策划 + 30s 种草视频成片",
    href: "/ecom/seed-video",
    icon: Film,
  },
  {
    id: "hand-craft",
    title: "手办盲盒 SOP",
    description: "线稿转潮玩盲盒 IP 全案",
    href: "/ecom/hand-craft",
    icon: Sparkles,
  },
];
