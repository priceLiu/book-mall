"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { TextTemplateThumb } from "@/components/image-editor/image-editor-text-template-art";
import type { ImageEditorTextQuickKind } from "@/lib/image-editor-text";
import {
  IMAGE_EDITOR_TEXT_TEMPLATE_CATEGORIES,
  IMAGE_EDITOR_TEXT_TEMPLATES,
  type ImageEditorTextTemplate,
} from "@/lib/image-editor-text-templates";

type Props = {
  disabled?: boolean;
  onAdd: (kind: ImageEditorTextQuickKind) => void;
  onPickTemplate: (templateId: string) => void;
};

const QUICK: Array<{ kind: ImageEditorTextQuickKind; label: string }> = [
  { kind: "title", label: "标题" },
  { kind: "subtitle", label: "副标题" },
  { kind: "body", label: "正文" },
];

const PREVIEW_COUNT = 3;

export function ImageEditorTextPanel({ disabled, onAdd, onPickTemplate }: Props) {
  const [query, setQuery] = useState("");
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const q = query.trim();
  const groups = useMemo(
    () =>
      IMAGE_EDITOR_TEXT_TEMPLATE_CATEGORIES.map((category) => ({
        ...category,
        items: IMAGE_EDITOR_TEXT_TEMPLATES.filter(
          (item) => item.category === category.id && (!q || item.label.includes(q) || item.sample.includes(q) || category.label.includes(q)),
        ),
      })).filter((group) => group.items.length > 0),
    [q],
  );
  const openCategory = openCategoryId
    ? IMAGE_EDITOR_TEXT_TEMPLATE_CATEGORIES.find((category) => category.id === openCategoryId) ?? null
    : null;
  const openItems = openCategory
    ? IMAGE_EDITOR_TEXT_TEMPLATES.filter(
        (item) => item.category === openCategory.id && (!q || item.label.includes(q) || item.sample.includes(q) || openCategory.label.includes(q)),
      )
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="text-[12px] font-semibold text-[var(--ie-ink)]">文字</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ie-subtle)]" aria-hidden />
        <input
          type="search"
          placeholder="搜索文字"
          disabled={disabled}
          value={query}
          className="w-full rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] py-2 pl-8 pr-2 text-[11px] text-[var(--ie-ink)] outline-none placeholder:text-[var(--ie-subtle)] focus:border-[var(--ie-border)]"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="flex gap-2">
        {QUICK.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            className="flex-1 rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream-muted)] py-2 text-[11px] font-medium text-[var(--ie-ink)] hover:border-[var(--ie-border)] disabled:opacity-40"
            onClick={() => onAdd(kind)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        {openCategory ? (
          <section className="space-y-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)]"
                aria-label="返回"
                onClick={() => setOpenCategoryId(null)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <h3 className="text-[12px] font-semibold text-[var(--ie-ink)]">{openCategory.label}</h3>
            </div>
            {openItems.length === 0 ? (
              <p className="px-1 text-[11px] text-[var(--ie-subtle)]">没有匹配的样式</p>
            ) : openCategory.id === "selling" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {openItems.map((item) => (
                    <TemplateTile key={item.id} item={item} disabled={disabled} wide onPick={onPickTemplate} />
                  ))}
                </div>
                <p className="py-3 text-center text-[11px] text-[var(--ie-subtle)]">没有更多了</p>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {openItems.map((item) => (
                  <TemplateTile key={item.id} item={item} disabled={disabled} onPick={onPickTemplate} />
                ))}
              </div>
            )}
          </section>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold text-[var(--ie-ink)]">{group.label}</h3>
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 text-[11px] text-[var(--ie-subtle)] hover:text-[var(--ie-ink)]"
                  onClick={() => setOpenCategoryId(group.id)}
                >
                  全部
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {group.items.slice(0, PREVIEW_COUNT).map((item) => (
                  <TemplateTile key={item.id} item={item} disabled={disabled} onPick={onPickTemplate} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function TemplateTile({
  item,
  disabled,
  wide,
  onPick,
}: {
  item: ImageEditorTextTemplate;
  disabled?: boolean;
  wide?: boolean;
  onPick: (templateId: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={item.label}
      title={item.label}
      className={
        wide
          ? "h-[92px] overflow-hidden rounded-md border border-[var(--ie-border-soft)] bg-white hover:border-[var(--ie-border)] disabled:opacity-40"
          : "h-[78px] overflow-hidden rounded-lg border border-[var(--ie-border-soft)] bg-[#f6f4ef] hover:border-[var(--ie-border)] disabled:opacity-40"
      }
      onClick={() => onPick(item.id)}
    >
      <TextTemplateThumb item={item} wide={wide} />
    </button>
  );
}
