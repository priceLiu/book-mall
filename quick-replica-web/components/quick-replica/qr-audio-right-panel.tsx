"use client";

import { useEffect } from "react";

import { QrTemplateGallery } from "@/components/quick-replica/qr-template-gallery";
import { QrVoiceGallery } from "@/components/quick-replica/qr-voice-gallery";
import { cacheSelectedVoice } from "@/lib/qr-audio-voice-selection";
import type { QrVoiceCatalogItem } from "@/lib/qr-audio-catalog-client";
import type { QrCategory, QrTemplate, QrWorkspaceDraft } from "@/lib/qr-template-types";

export type QrAudioRightTab = "templates" | "voices";

type Props = {
  category: QrCategory;
  titleSuffix?: string;
  templates: QrTemplate[];
  templatesLoading?: boolean;
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  onSelectTemplate: (template: QrTemplate) => void;
  activeTab: QrAudioRightTab;
  onTabChange: (tab: QrAudioRightTab) => void;
  voiceGalleryFocus?: boolean;
  onVoiceSelected?: () => void;
};

export function QrAudioRightPanel({
  category,
  titleSuffix,
  templates,
  templatesLoading,
  draft,
  onDraftChange,
  onSelectTemplate,
  activeTab,
  onTabChange,
  voiceGalleryFocus = false,
  onVoiceSelected,
}: Props) {
  useEffect(() => {
    if (!voiceGalleryFocus) return;
    onTabChange("voices");
  }, [voiceGalleryFocus, onTabChange]);

  const handleSelectVoice = (voice: QrVoiceCatalogItem) => {
    cacheSelectedVoice(voice);
    onDraftChange({ ...draft, voiceId: voice.voiceId });
    onVoiceSelected?.();
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden transition ${
        voiceGalleryFocus ? "qr-voice-gallery-focus" : ""
      }`}
    >
      <div className="flex shrink-0 gap-1 border-b border-white/10 px-4 py-2">
        {(
          [
            ["templates", "模板"],
            ["voices", "音色列表"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              activeTab === id
                ? id === "voices" && voiceGalleryFocus
                  ? "qr-voice-tab-active bg-[rgba(59,130,246,0.28)] text-[var(--qr-text-primary)]"
                  : "bg-[rgba(59,130,246,0.2)] text-[var(--qr-text-primary)]"
                : "text-[var(--qr-text-muted)] hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === "templates" ? (
        <QrTemplateGallery
          key={`audio-templates-${category}`}
          category={category}
          titleSuffix={titleSuffix}
          templates={templates}
          loading={templatesLoading ?? false}
          onSelectTemplate={onSelectTemplate}
        />
      ) : (
        <QrVoiceGallery
          selectedVoiceId={draft.voiceId}
          focusSelected={voiceGalleryFocus}
          onSelectVoice={handleSelectVoice}
        />
      )}
    </div>
  );
}
