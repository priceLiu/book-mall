"use client";

import Image from "next/image";
import { Check, ImageOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  formatEcomProjectUpdatedAt,
  type EcomProjectListItem,
} from "@/lib/ecom-project-list-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  emptyHint?: string;
  currentProjectId?: string | null;
  loadProjects: () => Promise<EcomProjectListItem[]>;
  onSelectProject: (id: string) => void | Promise<void>;
};

export function EcomProjectListDialog({
  open,
  onOpenChange,
  title = "项目列表",
  description = "选择已保存的项目，在当前页面打开继续编辑。",
  emptyHint = "还没有保存过的项目。可以先新建一个，完成工作后点「保存」。",
  currentProjectId,
  loadProjects,
  onSelectProject,
}: Props) {
  const [projects, setProjects] = useState<EcomProjectListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setOpeningId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadProjects()
      .then((items) => {
        if (!cancelled) setProjects(items);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadProjects, open]);

  async function handleSelect(id: string) {
    if (openingId) return;
    setOpeningId(id);
    try {
      await onSelectProject(id);
      onOpenChange(false);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[#f0f0f2] px-5 py-4">
          <DialogTitle className="text-[15px]">{title}</DialogTitle>
          <p className="text-[12px] text-[#86868b]">{description}</p>
        </DialogHeader>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="grid place-items-center gap-2 py-14 text-sm text-[#86868b]">
              <Loader2 className="h-5 w-5 animate-spin" />
              正在加载项目…
            </div>
          ) : error ? (
            <p className="py-14 text-center text-sm text-[#c0392b]">{error}</p>
          ) : projects.length === 0 ? (
            <p className="py-14 text-center text-sm text-[#86868b]">{emptyHint}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {projects.map((p) => {
                const active = p.id === currentProjectId;
                const opening = p.id === openingId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={Boolean(openingId)}
                    onClick={() => void handleSelect(p.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-colors",
                      active
                        ? "border-[#0071e3] bg-[#f0f6ff]"
                        : "border-[#e8e8ed] bg-white hover:border-[#d2d2d7]",
                      openingId && !opening ? "opacity-60" : "",
                    )}
                  >
                    <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f5f7]">
                      {p.thumbnailUrl ? (
                        <Image
                          src={p.thumbnailUrl}
                          alt={p.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <ImageOff className="h-4 w-4 text-[#c7c7cc]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[#1d1d1f]">
                        {p.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[#86868b]">
                        {p.subtitle ? `${p.subtitle} · ` : ""}
                        {formatEcomProjectUpdatedAt(p.updatedAt)}
                      </span>
                      {active ? (
                        <span className="mt-0.5 block text-[11px] text-[#0071e3]">当前打开</span>
                      ) : null}
                    </span>
                    {opening ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0071e3]" />
                    ) : active ? (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[#f0f0f2] px-5 py-3">
          <EcomButtonSecondary size="sm" type="button" onClick={() => onOpenChange(false)}>
            关闭
          </EcomButtonSecondary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
