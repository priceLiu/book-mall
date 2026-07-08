"use client";

import {
  Bot,
  Camera,
  Clapperboard,
  ImageIcon,
  Printer,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

export function ImageEnhancerGuideSections() {
  const problems = [
    {
      icon: Camera,
      color: "text-emerald-600",
      title: "低光手机照片",
      desc: "室内/夜景照片拍出来颗粒感很强，色彩也比较暗淡。降噪功能可以恢复照片的纹理，色彩增强功能可以恢复照片的鲜艳度。",
    },
    {
      icon: ImageIcon,
      color: "text-amber-600",
      title: "过度压缩的 JPEG 图像",
      desc: "社交媒体重新保存和 WhatsApp 导出会导致边缘细节丢失。增强功能无需放大即可重建清晰的边缘。",
    },
    {
      icon: Bot,
      color: "text-emerald-600",
      title: "人工智能生成的艺术",
      desc: "清除 SDXL / FLUX 造成的软斑，而不会影响材质或颜色。",
    },
    {
      icon: ImageIcon,
      color: "text-sky-600",
      title: "旧扫描照片",
      desc: "锐化模糊的家庭照片和老照片。与上色功能配合使用，可使黑白照片焕然一新。",
    },
    {
      icon: ShoppingBag,
      color: "text-rose-600",
      title: "电子商务照片",
      desc: "为亚马逊、Shopify 和 Etsy 商品列表提供清晰的产品图片。",
    },
    {
      icon: Clapperboard,
      color: "text-violet-600",
      title: "视频截图",
      desc: "发布前请修复模糊的屏幕截图和缩略图。",
    },
  ];

  const steps = [
    {
      title: "上传您的图片",
      desc: "任何大小不超过 10MB 的 JPG、PNG 或 WebP 文件。我们保持原始分辨率——这是质量提升，而非放大。",
    },
    {
      title: "选择增强模型",
      desc: "经 Gateway 调用百炼 Qwen 图像编辑模型，支持降噪、锐化与自然色彩还原。",
    },
    {
      title: "运行增强",
      desc: "一次性完成降噪、锐化和重新饱和处理。尺寸保持不变。",
    },
    {
      title: "比较和下载",
      desc: "查看生成结果并下载增强后的 PNG 图片，自动保存到「我的资产」。",
    },
  ];

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">解决这些常见问题</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4"
            >
              <p.icon className={cn("mb-2 h-5 w-5", p.color)} />
              <p className="font-medium text-[#1d1d1f]">{p.title}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">如何增强图像</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-[#1d1d1f]">{s.title}</p>
                <p className="mt-1 text-sm text-[#6e6e73]">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function ImageOutpaintGuideSections() {
  const useCases = [
    { icon: Printer, color: "text-sky-600", title: "准备用于打印的照片", desc: "扩展画布以适配海报与印刷排版。" },
    { icon: Sparkles, color: "text-violet-600", title: "推向 4K / Retina", desc: "在保持主体的同时拓宽视野。" },
    { icon: Bot, color: "text-emerald-600", title: "扩大 AI 艺术", desc: "为生成图补充背景与氛围。" },
    { icon: ImageIcon, color: "text-amber-600", title: "拯救微小的缩略图", desc: "从裁切过紧的画面中恢复上下文。" },
    { icon: ShoppingBag, color: "text-rose-600", title: "产品图片", desc: "为电商主图扩展留白与场景。" },
    { icon: Camera, color: "text-emerald-600", title: "扫描文件", desc: "修复扫描件边缘缺失区域。" },
  ];

  const steps = [
    { title: "上传您的图片", desc: "JPG、PNG 或 WebP，最大 10MB。" },
    { title: "选择扩图方式", desc: "等比例扩展、指定宽高比、四向像素或旋转扩图。" },
    { title: "运行扩图", desc: "经 Gateway 调用百炼 image-out-painting，通常数十秒完成。" },
    { title: "下载高分辨率", desc: "结果保存为 PNG 并写入「我的资产」。" },
  ];

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">你可以扩展什么</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4"
            >
              <p.icon className={cn("mb-2 h-5 w-5", p.color)} />
              <p className="font-medium text-[#1d1d1f]">{p.title}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">如何将图像扩展</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-[#1d1d1f]">{s.title}</p>
                <p className="mt-1 text-sm text-[#6e6e73]">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}