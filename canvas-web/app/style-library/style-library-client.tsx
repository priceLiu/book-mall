"use client";

import Link from "next/link";
import { useState } from "react";
import { LayoutGrid } from "lucide-react";

import { StyleLibraryGrid } from "@/components/canvas/style-library-grid";
import { StoryMediaPreviewModal } from "@/components/canvas/story-column-media-panel";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";
import { PRO_ASSETS_LINK_CLASS } from "@/lib/canvas/story-pro-node-chrome";

export function StyleLibraryClient() {
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  );

  return (
    <>
      <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
        <header className="mb-8">
          <p className="twenty-eyebrow">canvas-web · style library</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="canvas-serif flex items-center gap-2 text-3xl text-white">
                <LayoutGrid className="size-7 text-cyan-400" />
                风格库
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--canvas-muted)]">
                平台内置视觉风格预设。悬停卡片可预览提示词；在 Story-Pro / Pro2
                画布顶栏或节点内打开同一套库，可套用至风格定义节点或生成风格素材卡。
              </p>
            </div>
            <Link href="/projects" className={PRO_ASSETS_LINK_CLASS}>
              打开画布
            </Link>
          </div>
        </header>

        <div className="rounded-xl border border-cyan-400/15 bg-cyan-950/10 p-5">
          <StyleLibraryGrid
            fixedFilter
            selectLabel="预览"
            onSelect={(preset: StyleLibraryPreset) =>
              setPreview({ url: preset.imageUrl, title: preset.name })
            }
            onPreview={(preset: StyleLibraryPreset) =>
              setPreview({ url: preset.imageUrl, title: preset.name })
            }
          />
        </div>
      </div>

      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
