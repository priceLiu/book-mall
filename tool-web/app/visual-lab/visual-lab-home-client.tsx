"use client";

import Link from "next/link";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";
import { VisualLabHero } from "@/components/ui/hero-visual-lab";
import { useToolsSession } from "@/components/tool-shell-client";

export function VisualLabHomeClient({
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
      <VisualLabHero />

      <section
        id="visual-lab-panel"
        className="mx-auto max-w-[1100px] px-4 pb-12 sm:px-6"
        aria-labelledby="visual-lab-heading"
      >
        <h1 id="visual-lab-heading" className="vl-h1">
          视觉实验室
        </h1>
        <p className="vl-muted mt-1 text-sm">
          首屏与 <strong className="font-semibold text-[var(--vl-fg)]">图生视频</strong> 同级：
          <strong className="font-semibold text-[var(--vl-fg)]">分析室</strong>{" "}
          里生成本地速写，
          <strong className="font-semibold text-[var(--vl-fg)]">成果展</strong>{" "}
          汇聚你保存的快照（当前仅本机浏览器）。
        </p>

        {loading ? (
          <p className="vl-muted mt-6" role="status">
            正在同步会话…
          </p>
        ) : !session.active ? (
          <div className="vl-note mt-6 max-w-xl">
            <p className="mb-2 text-sm">
              使用工具前请先通过主站登录并进入工具站（令牌过期时需重新连接）。
            </p>
            {renewHref ? (
              <p className="mb-2 text-sm">
                <Link href={renewHref} className="vl-inline-link">
                  从主站重新连接工具站
                </Link>
              </p>
            ) : null}
            {originConfigured ? (
              <p className="vl-muted text-xs">
                <Link href={`${mainOrigin}/account`} className="vl-inline-link">
                  个人中心
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/visual-lab/analysis" className="vl-btn vl-btn-primary">
              打开分析室
            </Link>
            <Link href="/visual-lab/gallery" className="vl-btn vl-btn-outline">
              成果展
            </Link>
          </div>
        )}
      </section>

      <section id="visual-lab-intro" className="vl-intro-band">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
          <h2 className="vl-section-title">能力说明</h2>
          <p className="tw-muted mt-2 text-sm">
            <ToolImplementationCrossLink href="/visual-lab/implementation" />
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              <strong>分析室</strong>
              ：拖入或选择图片，在浏览器内用 Canvas 采样得到分辨率、宽高比标签、平均 RGB 与亮度；可写简短备注，保存 PNG/JPEG
              缩略图到成果展。
            </li>
            <li>
              <strong>成果展</strong>
              ：读取本地 localStorage 列表；可删除条目。换浏览器或清除站点数据会丢失，后续可改为主站资产库。
            </li>
            <li>
              <strong>实现逻辑</strong>
              ：说明路由、navKey 及与图生视频同级的交付约定，便于接入上游多模态与计费时对齐。
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
