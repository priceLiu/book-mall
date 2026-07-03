"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

type PromptTemplateKind = "create-voiceover" | "voice-changer";

type TemplateDef = {
  id: string;
  name: string;
  content: string;
};

type Library = Record<PromptTemplateKind, TemplateDef[]>;

const EMPTY: Library = { "create-voiceover": [], "voice-changer": [] };

type Props = {
  kind: PromptTemplateKind;
  disabled?: boolean;
  onSaved?: () => void;
};

export function QrAdminPromptTemplatesEditor({ kind, disabled, onSaved }: Props) {
  const [library, setLibrary] = useState<Library>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchQrPlatform(
        "/api/book-mall/api/platform/v1/quick-replica/admin/audio-prompt-templates",
      );
      if (res.ok) {
        const data = (await res.json()) as { templates?: Library };
        setLibrary(data.templates ?? EMPTY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const templates = library[kind] ?? [];

  const updateTemplate = (index: number, patch: Partial<TemplateDef>) => {
    setLibrary((prev) => {
      const next = { ...prev, [kind]: [...(prev[kind] ?? [])] };
      next[kind][index] = { ...next[kind][index]!, ...patch };
      return next;
    });
  };

  const addTemplate = () => {
    const id = `tpl-${Date.now()}`;
    setLibrary((prev) => ({
      ...prev,
      [kind]: [...(prev[kind] ?? []), { id, name: "新模板", content: "" }],
    }));
  };

  const removeTemplate = (index: number) => {
    setLibrary((prev) => ({
      ...prev,
      [kind]: (prev[kind] ?? []).filter((_, i) => i !== index),
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetchQrPlatform(
        "/api/book-mall/api/platform/v1/quick-replica/admin/audio-prompt-templates",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templates: library }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `保存失败（${res.status}）`);
      }
      const data = (await res.json()) as { templates?: Library };
      setLibrary(data.templates ?? library);
      setMessage("已保存提示词模板");
      onSaved?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="qr-skeleton h-32 w-full rounded-xl" />;
  }

  return (
    <div
      className="space-y-3 rounded-xl border p-3"
      style={{ borderColor: "var(--qr-border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--qr-text-primary)]">
          提示词模板（前台 Prompt 下方 · 点击名填充 · 刷新轮换）
        </p>
        <button
          type="button"
          className="qr-btn-secondary px-2 py-1 text-[10px]"
          disabled={disabled || saving}
          onClick={() => void save()}
        >
          <Save className="mr-1 inline h-3 w-3" />
          {saving ? "保存中…" : "保存模板库"}
        </button>
      </div>

      {templates.map((tpl, index) => (
        <div
          key={tpl.id}
          className="space-y-2 rounded-lg border p-2.5"
          style={{ borderColor: "var(--qr-border)" }}
        >
          <div className="flex items-center gap-2">
            <input
              className="qr-input flex-1 text-xs"
              value={tpl.name}
              disabled={disabled}
              placeholder="模板名"
              onChange={(e) => updateTemplate(index, { name: e.target.value })}
            />
            <input
              className="qr-input w-28 font-mono text-[10px]"
              value={tpl.id}
              disabled={disabled}
              placeholder="id"
              onChange={(e) => updateTemplate(index, { id: e.target.value.trim() })}
            />
            <button
              type="button"
              className="rounded p-1 text-red-300 hover:bg-white/5"
              disabled={disabled}
              onClick={() => removeTemplate(index)}
              aria-label="删除模板"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            className="qr-input min-h-[72px] w-full resize-y text-xs"
            value={tpl.content}
            disabled={disabled}
            placeholder="模板内容（点击前台模板名会填入 Prompt）"
            onChange={(e) => updateTemplate(index, { content: e.target.value })}
          />
        </div>
      ))}

      <button
        type="button"
        className="qr-btn-secondary flex w-full items-center justify-center gap-1 text-xs"
        disabled={disabled}
        onClick={addTemplate}
      >
        <Plus className="h-3.5 w-3.5" />
        添加模板
      </button>

      {message ? <p className="text-[10px] text-[var(--qr-text-muted)]">{message}</p> : null}
    </div>
  );
}

import { invalidateQrAudioCatalogClientCache } from "@/lib/qr-audio-catalog-client";

export function invalidateQrAudioCatalogCache(): void {
  invalidateQrAudioCatalogClientCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("qr-audio-catalog-invalidate"));
  }
}
