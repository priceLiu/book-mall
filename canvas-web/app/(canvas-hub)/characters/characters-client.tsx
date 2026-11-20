"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListSkeleton } from "@/components/canvas/canvas-list-skeleton";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { GalleryMediaCard } from "@/components/gallery/gallery-media-card";
import {
  deleteCanvasCharacter,
  listCanvasCharacters,
  type CanvasCharacterRecord,
} from "@/lib/canvas-api";

export function CharactersClient() {
  const base = useBookMallBaseUrl();
  const { doubleConfirm, alert } = useDialogs();
  const [characters, setCharacters] = useState<CanvasCharacterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      setCharacters(await listCanvasCharacters(base));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (c: CanvasCharacterRecord) => {
    if (!base) return;
    const ok = await doubleConfirm({
      first: {
        title: "删除角色？",
        message: `将从角色库移除「${c.name}」。`,
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 不可恢复",
        message: "角色库记录将被永久删除。",
        confirmLabel: "永久删除",
        danger: true,
      },
    });
    if (!ok) return;
    try {
      await deleteCanvasCharacter(base, c.id);
      await load();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    }
  };

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading && characters.length === 0 ? (
        <CanvasListSkeleton sections={1} cardsPerSection={10} />
      ) : characters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] p-12 text-center text-sm text-[var(--canvas-muted)]">
          还没有角色。在
          <Link href="/projects" className="mx-1 text-[var(--canvas-accent)] hover:underline">
            画布
          </Link>
          的三视图节点生成后点「保存角色」即可入库。
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {characters.map((c) => (
            <li key={c.id} className="group relative">
              <GalleryMediaCard
                src={c.imageUrl}
                alt={c.name}
                title={c.name}
                subtitle={
                  c.model
                    ? `${c.model} · ${new Date(c.updatedAt).toLocaleString("zh-CN")}`
                    : new Date(c.updatedAt).toLocaleString("zh-CN")
                }
                downloadName={`${c.name}.png`}
              />
              <button
                type="button"
                onClick={() => void onDelete(c)}
                className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-[var(--canvas-muted)] opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                title="删除"
                aria-label={`删除 ${c.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
