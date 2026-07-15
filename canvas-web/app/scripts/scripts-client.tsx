"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Plus } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { ProjectsSubNav } from "@/components/layout/projects-sub-nav";
import { listPickableScriptPackages } from "@/lib/canvas/list-pickable-script-packages";
import type { NewProjectScriptPackageAsset } from "@/lib/canvas/pro2-new-project-script-package";

export function ScriptsClient() {
  const base = useBookMallBaseUrl();
  const [scripts, setScripts] = useState<NewProjectScriptPackageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      setScripts(await listPickableScriptPackages(base));
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

  return (
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex justify-center">
        <ProjectsSubNav />
      </div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="twenty-eyebrow">canvas-web · scripts</p>
          <h1 className="canvas-serif mt-2 flex items-center gap-2 text-3xl text-white">
            <FileText className="size-8 text-[var(--canvas-accent)]" />
            脚本
          </h1>
          <p className="mt-2 text-sm text-[var(--canvas-muted)]">
            已发布的剧本包。新建「生产画布」时选择「已有剧本」可关联此处条目。
          </p>
        </div>
        <Link href="/projects" className="twenty-btn-accent text-sm">
          <Plus className="mr-2 size-4" />
          新建关联画布
        </Link>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </div>
      ) : scripts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] p-12 text-center text-sm text-[var(--canvas-muted)]">
          还没有已发布剧本。在影视专业版 2.0 剧本创作画布中定稿并发布剧本包后，会出现在这里。
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scripts.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-white/10 bg-[var(--canvas-surface)] p-4"
            >
              <p className="font-medium text-white">{s.displayName}</p>
              <p className="mt-1 text-[11px] text-[var(--canvas-muted)]">
                ID · {s.id.slice(0, 12)}…
              </p>
              <Link
                href="/projects"
                className="mt-3 inline-block text-sm text-[var(--canvas-accent)] hover:underline"
              >
                用此剧本新建画布 →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
