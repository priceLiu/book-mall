"use client";

import { useCallback, useEffect, useState } from "react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { MODEL_SHOT_MODEL_ARCHETYPES } from "@/lib/model-shot-prompt-presets";
import type { ModelShotReference } from "@/lib/model-shot-types";
import { cn } from "@/lib/utils";

type Props = {
  modelRef: ModelShotReference | undefined;
  disabled?: boolean;
  onAttachArchetype: (archetype: (typeof MODEL_SHOT_MODEL_ARCHETYPES)[number]) => Promise<void>;
  onSaveDescription: (description: string) => Promise<void>;
};

const archetypeBtn = (active: boolean) =>
  cn(
    "rounded-lg border px-2 py-1.5 text-left text-[10px] transition",
    active
      ? "border-[var(--ecom-outline-border)] bg-[var(--ecom-content-selected-bg)]"
      : "border-[var(--ecom-divider)] hover:bg-[#fafafa]",
  );

/** 中栏 · 模特采集（虚拟人设 + 文字描述，无图参考） */
export function ModelShotModelCollectExtras({
  modelRef,
  disabled,
  onAttachArchetype,
  onSaveDescription,
}: Props) {
  const [draft, setDraft] = useState(() => modelRef?.description?.trim() ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(modelRef?.description?.trim() ?? "");
  }, [modelRef?.description, modelRef?.id]);

  const saveDesc = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      await onSaveDescription(text);
    } finally {
      setSaving(false);
    }
  }, [draft, onSaveDescription]);

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-[var(--ecom-divider)] bg-[#fafafa] px-3 py-2.5">
      <p className="text-[10px] font-medium text-[var(--ecom-muted)]">虚拟人设（文字参考，无需上传图）</p>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {MODEL_SHOT_MODEL_ARCHETYPES.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            className={archetypeBtn(modelRef?.name === a.label && modelRef?.source === "text")}
            onClick={() => void onAttachArchetype(a)}
          >
            <span className="font-medium text-[var(--ecom-ink)]">{a.label}</span>
            <span className="mt-0.5 line-clamp-2 text-[var(--ecom-subtle)]">{a.description}</span>
          </button>
        ))}
      </div>
      <div>
        <p className="mb-1 text-[10px] font-medium text-[var(--ecom-muted)]">或手写模特描述</p>
        <textarea
          className="min-h-[64px] w-full resize-y rounded-lg border border-[var(--ecom-divider)] bg-white px-2 py-1.5 text-[11px]"
          placeholder="外貌、身形、气质…"
          value={draft}
          disabled={disabled || saving}
          onChange={(e) => setDraft(e.target.value)}
        />
        <EcomButtonSecondary
          size="sm"
          type="button"
          className="mt-1.5 h-7 w-full text-[10px]"
          disabled={disabled || saving || !draft.trim()}
          onClick={() => void saveDesc()}
        >
          {saving ? "保存中…" : "保存为模特文字参考"}
        </EcomButtonSecondary>
      </div>
    </div>
  );
}