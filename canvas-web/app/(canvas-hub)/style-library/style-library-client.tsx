"use client";

import { useState } from "react";

import { StyleLibraryGrid } from "@/components/canvas/style-library-grid";
import { StoryMediaPreviewModal } from "@/components/canvas/story-column-media-panel";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";

export function StyleLibraryClient() {
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  );

  return (
    <>
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
