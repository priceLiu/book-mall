"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { ImageEditorAiGenStyleCardMeta } from "@/components/image-editor/image-editor-ai-gen-style-card-meta";
import { ImageEditorAiGenStyleThumb } from "@/components/image-editor/image-editor-ai-gen-style-thumb";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AI_GEN_STYLE_CATEGORY_LABEL,
  filterAiGenStyleModels,
  type AiGenStyleCategory,
  type AiGenStyleModel,
} from "@/lib/image-editor-ai-gen-style-models";
import { cn } from "@/lib/utils";

const TABS: AiGenStyleCategory[] = ["hot", "oriental", "photo", "design", "3d"];

type Props = {
  open: boolean;
  selectedId: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (model: AiGenStyleModel) => void;
};

export function ImageEditorAiGenStyleModal({ open, selectedId, onOpenChange, onSelect }: Props) {
  const [tab, setTab] = useState<AiGenStyleCategory>("hot");
  const [query, setQuery] = useState("");

  const items = useMemo(() => filterAiGenStyleModels({ category: tab, query }), [query, tab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(896px,94vw)] max-w-none flex-col gap-0 overflow-hidden bg-[var(--ie-cream)] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ie-border-soft)] px-4 py-3 pr-12">
          <DialogTitle className="text-base font-semibold text-[var(--ie-ink)]">风格模型</DialogTitle>
          <label className="relative flex h-9 min-w-[200px] max-w-xs flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-[var(--ie-muted)]" aria-hidden />
            <input
              type="search"
              value={query}
              placeholder="搜索模型"
              className="h-full w-full rounded-full border border-[var(--ie-border-soft)] bg-white py-1 pl-9 pr-8 text-[13px] outline-none focus:border-[#0071e3]"
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button
                type="button"
                aria-label="清除搜索"
                className="absolute right-2 grid h-5 w-5 place-items-center text-[var(--ie-muted)]"
                onClick={() => setQuery("")}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </label>
        </div>

        <div className="border-b border-[var(--ie-border-soft)] px-4">
          <div className="ecom-scrollbar-thin flex gap-4 overflow-x-auto">
            {TABS.map((id) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "relative shrink-0 py-2.5 text-[13px]",
                    active ? "font-medium text-[#0071e3]" : "text-[var(--ie-muted)] hover:text-[var(--ie-ink)]",
                  )}
                  onClick={() => setTab(id)}
                >
                  {AI_GEN_STYLE_CATEGORY_LABEL[id]}
                  {active ? (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[#0071e3]" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4" style={{ maxHeight: "min(580px, 60vh)" }}>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--ie-muted)]">未找到匹配的风格</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((model) => {
                const selected = model.id === selectedId;
                return (
                  <button
                    key={model.id}
                    type="button"
                    className={cn(
                      "rounded-xl border bg-white text-left transition-shadow hover:shadow-md",
                      selected ? "border-[#0071e3] ring-1 ring-[#0071e3]/40" : "border-[var(--ie-border-soft)]",
                    )}
                    onClick={() => {
                      onSelect(model);
                      onOpenChange(false);
                    }}
                  >
                    <div className="overflow-hidden rounded-t-xl">
                      <ImageEditorAiGenStyleThumb model={model} />
                    </div>
                    <ImageEditorAiGenStyleCardMeta model={model} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}