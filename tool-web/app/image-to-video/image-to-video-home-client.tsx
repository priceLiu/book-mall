"use client";

import Link from "next/link";
import { ImageToVideoHero } from "@/components/ui/hero-image-to-video";
import { useToolsSession } from "@/components/tool-shell-client";

export function ImageToVideoHomeClient({
  renewHref,
  mainOrigin,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
}) {
  const { loading, session } = useToolsSession();
  const originConfigured =
    typeof mainOrigin === "string" && mainOrigin.trim().length > 0;

  return (
    <>
      <ImageToVideoHero />

      <section
        id="image-to-video-panel"
        className="mx-auto max-w-[1100px] px-4 pb-12 sm:px-6"
        aria-labelledby="image-to-video-heading"
      >
        <h1 id="image-to-video-heading" className="mt-0 text-2xl font-bold tracking-tight">
          图生视频
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          首页导航与文生图一致：生成入口在 <strong>实验室</strong>，资产管理在{" "}
          <strong>我的视频库</strong>。
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          对接推理接口后，将在此补充实现逻辑与计费说明链接。
        </p>

        {loading ? (
          <p className="tw-muted mt-6" role="status">
            正在同步会话…
          </p>
        ) : !session.active ? (
          <div className="tw-note mt-6 max-w-xl">
            <p className="mb-2 text-sm">
              使用工具前请先通过主站登录并进入工具站（令牌过期时需重新连接）。
            </p>
            {renewHref ? (
              <p className="mb-2 text-sm">
                <Link href={renewHref} className="text-primary underline">
                  从主站重新连接工具站
                </Link>
              </p>
            ) : null}
            {originConfigured ? (
              <p className="text-xs text-muted-foreground">
                <Link href={`${mainOrigin}/account`} className="underline">
                  个人中心
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/image-to-video/lab"
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-violet-700"
            >
              打开实验室
            </Link>
            <Link
              href="/image-to-video/library"
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted"
            >
              我的视频库
            </Link>
          </div>
        )}
      </section>

      <section
        id="image-to-video-intro"
        className="border-t border-border/80 bg-muted/30 py-12"
      >
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
          <h2 className="text-lg font-semibold">能力说明（预览版）</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground leading-relaxed">
            <li>
              <strong className="text-foreground">实验室</strong>
              ：首帧 + 提示词 + 清晰度；支持示例图切换，选中后大图在上方、提示词同步，可再手动改文案。
            </li>
            <li>
              <strong className="text-foreground">生成态</strong>
              ：排队与倒计时占位；成片后可预览播放器与元信息（时长、分辨率等）。
            </li>
            <li>
              <strong className="text-foreground">我的视频库</strong>
              ：列表、预览、下载入口对齐「我的图片库」交互；当前为静态示例数据。
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
