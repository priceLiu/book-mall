"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FilePlus2, X } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import type { CanvasPromptEngineKind } from "@/lib/canvas-prompt-templates-api";
import type { AppliedPromptTemplate } from "@/lib/canvas-prompt-templates-api";
import { usePromptTemplates } from "@/lib/canvas/use-prompt-templates";

export type PromptTemplatePickerProps = {
  engine: CanvasPromptEngineKind;
  currentPrompt: string;
  onApply: (template: AppliedPromptTemplate) => void;
  /** 按钮文案 */
  label?: string;
};

/**
 * 从配置页读取的提示词模板列表，居中弹层选择后写入节点 prompt。
 */
export function PromptTemplatePicker({
  engine,
  currentPrompt,
  onApply,
  label = "插入提示词模板",
}: PromptTemplatePickerProps) {
  const { templates, loading } = usePromptTemplates(engine);
  const { confirm } = useDialogs();
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const builtins = templates.filter((t) => t.builtin);
    const user = templates.filter((t) => !t.builtin);
    return { builtins, user };
  }, [templates]);

  const apply = async (template: AppliedPromptTemplate) => {
    if (currentPrompt.trim()) {
      const ok = await confirm({
        title: "覆盖现有 prompt？",
        message: "当前内容将被替换为所选模板。",
        confirmLabel: "覆盖",
        danger: true,
      });
      if (!ok) return;
    }
    onApply(template);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen(true)}
        className="nodrag inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/80 hover:border-white/30 hover:text-white disabled:opacity-50"
      >
        <FilePlus2 className="size-3" />
        {loading ? "加载模板…" : label}
        <ChevronDown className="size-3 opacity-60" />
      </button>

      {open ? (
        <PromptTemplateModal
          engine={engine}
          grouped={grouped}
          loading={loading}
          templatesCount={templates.length}
          onClose={() => setOpen(false)}
          onApply={(template) => void apply(template)}
        />
      ) : null}
    </>
  );
}

type Grouped = {
  builtins: ReturnType<typeof usePromptTemplates>["templates"];
  user: ReturnType<typeof usePromptTemplates>["templates"];
};

function PromptTemplateModal({
  engine,
  grouped,
  loading,
  templatesCount,
  onClose,
  onApply,
}: {
  engine: CanvasPromptEngineKind;
  grouped: Grouped;
  loading: boolean;
  templatesCount: number;
  onClose: () => void;
  onApply: (template: AppliedPromptTemplate) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  const title = engine === "LLM" ? "选择 AI 引擎提示词模板" : "选择生图提示词模板";

  const node = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface,#161427)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="text-base font-medium text-white">{title}</h2>
            <p className="mt-1 text-[12px] text-white/50">
              点击模板即可插入；上游文本参数会在选用后自动追加到提示词下方。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-white/50">加载模板…</p>
          ) : templatesCount === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">
              暂无模板。去「配置 → 提示词模板」添加。
            </p>
          ) : (
            <div className="space-y-6">
              {grouped.builtins.length > 0 ? (
                <section>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
                    系统模板
                  </p>
                  <div className="space-y-3">
                    {grouped.builtins.map((t) => (
                      <TemplateCard
                        key={t.id}
                        name={t.name}
                        description={t.description}
                        content={t.content}
                        badge="系统"
                        onSelect={() =>
                          onApply({
                            id: t.id,
                            name: t.name,
                            content: t.content,
                            builtin: true,
                          })
                        }
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {grouped.user.length > 0 ? (
                <section>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
                    我的模板
                  </p>
                  <div className="space-y-3">
                    {grouped.user.map((t) => (
                      <TemplateCard
                        key={t.id}
                        name={t.name}
                        description={null}
                        content={t.content}
                        onSelect={() =>
                          onApply({
                            id: t.id,
                            name: t.name,
                            content: t.content,
                            builtin: false,
                          })
                        }
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function TemplateCard({
  name,
  description,
  content,
  badge,
  onSelect,
}: {
  name: string;
  description?: string | null;
  content: string;
  badge?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="nodrag flex w-full flex-col items-start rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-left transition hover:border-[var(--canvas-accent)]/40 hover:bg-white/5"
    >
      <div className="flex w-full items-center gap-2">
        {badge ? (
          <span className="shrink-0 rounded bg-[var(--canvas-accent)]/25 px-1.5 py-0.5 text-[10px] text-white">
            {badge}
          </span>
        ) : null}
        <span className="font-medium text-white">{name}</span>
      </div>
      {description ? (
        <p className="mt-1 text-[11px] text-white/50">{description}</p>
      ) : null}
      <pre className="mt-2 w-full whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/70">
        {content}
      </pre>
    </button>
  );
}
