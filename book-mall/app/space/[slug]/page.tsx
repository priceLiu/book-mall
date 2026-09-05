import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpaceCanvasView } from "@/components/ai-space/space-canvas/space-canvas-view";
import { getPublicSpaceBySlug } from "@/lib/ai-space/ai-space-space-service";
import { SPACE_THEME_TOKENS } from "@/lib/ai-space/space-blocks/theme";

/**
 * 公开 AI 空间。
 *
 * 放在 `(site)` 之外：那一层的 layout 是 force-dynamic，会让 ISR 失效；
 * 分享页也不需要登录态导航，独立渲染更干净。
 * 只读展示 → ISR 5 分钟，访客流量不打 DB。
 */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await getPublicSpaceBySlug(params.slug);
  if (!page) return { title: "空间不存在" };
  return {
    title: page.title,
    description: page.bio.slice(0, 160) || undefined,
    openGraph: {
      title: page.title,
      description: page.bio.slice(0, 160) || undefined,
    },
  };
}

export default async function PublicSpacePage({
  params,
}: {
  params: { slug: string };
}) {
  const page = await getPublicSpaceBySlug(params.slug);
  // 未发布与不存在一律 404，不泄露草稿是否存在
  if (!page) notFound();

  const theme = SPACE_THEME_TOKENS[page.theme.preset];

  return (
    <main className="min-h-screen" style={{ background: theme.canvasBg }}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: theme.text }}>
            {page.title}
          </h1>
          {page.bio ? (
            <p
              className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed"
              style={{ color: theme.mutedText }}
            >
              {page.bio}
            </p>
          ) : null}
          {page.ownerDisplayName ? (
            <p className="mt-2 text-xs" style={{ color: theme.mutedText }}>
              作者 {page.ownerDisplayName}
            </p>
          ) : null}
        </header>

        <SpaceCanvasView page={page} />

        <footer
          className="mt-12 border-t pt-4 text-xs"
          style={{ borderColor: theme.border, color: theme.mutedText }}
        >
          <a href="/" className="underline">
            AI-code8
          </a>
          <span> · 我的 AI 空间</span>
        </footer>
      </div>
    </main>
  );
}
