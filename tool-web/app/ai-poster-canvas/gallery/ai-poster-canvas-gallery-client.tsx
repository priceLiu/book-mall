"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, ImageIcon } from "lucide-react";
import { mainSiteCanvasOpenHref } from "@/lib/main-site-app-open-links";

const PREVIEW_SLOTS = [
  { hint: "电商产品海报" },
  { hint: "短视频封面" },
  { hint: "三视图 · 正" },
  { hint: "三视图 · 侧" },
  { hint: "三视图 · 后" },
  { hint: "你的下一张画作" },
];

export function AiPosterCanvasGalleryClient() {
  const canvasGalleryHref = mainSiteCanvasOpenHref("/gallery");
  const canvasProjectsHref = mainSiteCanvasOpenHref("/projects");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8">
        <Link
          href="/ai-poster-canvas"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← AI 海报画布首页
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">画作</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          所有从画布「输出节点」一键收藏的画作汇集到这里。完整画作库与原图查看在
          canvas-web 端，登录账户与本站完全一致。
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <a
          href={canvasGalleryHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          打开 canvas-web 画作库
          <ExternalLink className="size-4" />
        </a>
        <a
          href={canvasProjectsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          去创意画室
          <ArrowRight className="size-4" />
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PREVIEW_SLOTS.map((slot, i) => (
          <div
            key={i}
            className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400"
          >
            <ImageIcon className="size-7 opacity-60" />
            <p className="text-xs text-neutral-500">{slot.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
        <p className="font-medium text-neutral-900">技术说明</p>
        <p className="mt-2">
          画作数据来自主站接口{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-[12px]">
            GET /api/canvas/works
          </code>
          ，由 canvas-web（独立子站，登录走同一 NextAuth 会话）统一渲染。
          后续会引入跨站 SSO 拉取，把画作直接镶嵌在本页。
        </p>
      </div>
    </div>
  );
}
