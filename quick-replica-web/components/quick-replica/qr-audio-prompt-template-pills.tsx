"use client";

import { RefreshCw } from "lucide-react";

import type { QrAudioCatalog, QrAudioPromptTemplateDef } from "@/lib/qr-audio-catalog-client";
import { findPromptTemplate, pickNextPromptTemplate } from "@/lib/qr-audio-prompt-templates";

type Props = {
  catalog: QrAudioCatalog;
  kind: "create-voiceover" | "voice-changer" | "create-sfx" | "create-music";
  activeTemplateId?: string;
  busy?: boolean;
  onApply: (template: QrAudioPromptTemplateDef) => void;
};

function templatesForKind(
  catalog: QrAudioCatalog,
  kind: Props["kind"],
): QrAudioPromptTemplateDef[] {
  const fromLib = catalog.promptTemplates?.[kind];
  if (fromLib?.length) return fromLib;
  if (kind === "create-voiceover") {
    return catalog.styleTags.map((tag) => ({
      id: tag.id,
      name: tag.label,
      content: tag.content ?? "",
    }));
  }
  if (kind === "create-sfx") {
    return (catalog.sfxStyleTags ?? []).map((tag) => ({
      id: tag.id,
      name: tag.label,
      content: tag.content ?? "",
    }));
  }
  if (kind === "create-music") {
    return (catalog.musicStyleTags ?? []).map((tag) => ({
      id: tag.id,
      name: tag.label,
      content: tag.content ?? "",
    }));
  }
  return [];
}

export function QrAudioPromptTemplatePills({
  catalog,
  kind,
  activeTemplateId,
  busy,
  onApply,
}: Props) {
  const templates = templatesForKind(catalog, kind);
  if (!templates.length) return null;

  const activeId =
    activeTemplateId && templates.some((t) => t.id === activeTemplateId)
      ? activeTemplateId
      : templates[0]?.id;

  const handleRefresh = () => {
    const next = pickNextPromptTemplate(templates, activeId);
    if (next?.content) onApply(next);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {templates.map((tpl) => {
        const active = activeId === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            disabled={busy || !tpl.content}
            title={tpl.content ? undefined : "模板内容为空"}
            onClick={() => {
              if (tpl.content) onApply(tpl);
            }}
            className={`rounded-full border px-3 py-1 text-[11px] transition ${
              active
                ? "border-[var(--qr-brand)] bg-[rgba(59,130,246,0.12)] text-[var(--qr-text-primary)]"
                : "border-white/10 text-[var(--qr-text-muted)] hover:border-white/20"
            } disabled:opacity-40`}
          >
            {tpl.name}
          </button>
        );
      })}
      <button
        type="button"
        disabled={busy || templates.every((t) => !t.content)}
        className="rounded-full border border-white/10 p-1.5 text-[var(--qr-text-muted)] hover:border-white/20"
        aria-label="切换下一组模板"
        onClick={handleRefresh}
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function resolveActivePromptTemplateId(
  catalog: QrAudioCatalog,
  kind: "create-voiceover" | "voice-changer" | "create-sfx" | "create-music",
  prompt: string,
  styleTag?: string,
): string | undefined {
  const templates = templatesForKind(catalog, kind);
  if (styleTag && templates.some((t) => t.id === styleTag)) return styleTag;
  const byContent = templates.find((t) => t.content && t.content === prompt.trim());
  if (byContent) return byContent.id;
  return templates[0]?.id;
}

export { findPromptTemplate, templatesForKind };
