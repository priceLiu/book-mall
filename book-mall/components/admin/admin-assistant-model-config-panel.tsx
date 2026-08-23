"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import type { AdminAssistantModelConfigPayload } from "@/app/api/admin/platform-assistant/model-config/route";
import type { PlatformAssistantModelConfigView } from "@/lib/platform-assistant/platform-assistant-model-config-service";

const inputCls =
  "w-full rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-sm text-[#1f2328] focus:border-[#0969da] focus:outline-none";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#1f2328]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[#d1d9e0]"
      />
      {label}
    </label>
  );
}

function SlotCard({
  title,
  desc,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#d1d9e0]/80 bg-[#f6f8fa]/60 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-[#1f2328]">{title}</h3>
          <p className="mt-0.5 text-xs text-[#656d76]">{desc}</p>
        </div>
        <Toggle checked={enabled} onChange={onEnabledChange} label="启用" />
      </div>
      <div className={enabled ? "space-y-3" : "pointer-events-none space-y-3 opacity-50"}>
        {children}
      </div>
    </div>
  );
}

function FallbackPicker({
  candidates,
  primary,
  selected,
  onChange,
}: {
  candidates: { modelKey: string; displayName: string }[];
  primary: string;
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const options = candidates.filter((c) => c.modelKey !== primary);

  const toggle = (modelKey: string) => {
    if (selected.includes(modelKey)) {
      onChange(selected.filter((k) => k !== modelKey));
    } else {
      onChange([...selected, modelKey]);
    }
  };

  if (options.length === 0) {
    return <p className="text-xs text-[#656d76]">暂无其他可选模型</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((c) => {
        const active = selected.includes(c.modelKey);
        return (
          <button
            key={c.modelKey}
            type="button"
            onClick={() => toggle(c.modelKey)}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${
              active
                ? "border-[#0969da] bg-[#eff6ff] text-[#0969da]"
                : "border-[#d1d9e0] bg-white text-[#656d76] hover:border-[#0969da]/50"
            }`}
          >
            {c.displayName}
          </button>
        );
      })}
    </div>
  );
}

export function AdminAssistantModelConfigPanel({
  initial,
}: {
  initial: AdminAssistantModelConfigPayload;
}) {
  const [config, setConfig] = useState<PlatformAssistantModelConfigView>(initial.config);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const llmOptions = useMemo(
    () =>
      initial.llmCandidates.map((c) => ({
        modelKey: c.modelKey,
        displayName: c.displayName,
        label: `${c.displayName} · ${c.vendor}`,
      })),
    [initial.llmCandidates],
  );

  const selectedEmbed = useMemo(
    () => initial.embedCandidates.find((c) => c.modelKey === config.embedModelKey),
    [initial.embedCandidates, config.embedModelKey],
  );

  const onSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/platform-assistant/model-config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        config?: PlatformAssistantModelConfigView;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.config) {
        throw new Error(data.error ?? "保存失败");
      }
      setConfig(data.config);
      setMessage("已保存，全站 AI 小智将使用新模型配置。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#d1d9e0]/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1f2328]">AI 小智 · 模型选择</h2>
          <p className="mt-1 text-sm text-[#656d76]">
            平台代付，不计用户积分。配置保存在数据库，无需改环境变量。
            {config.updatedAt ? (
              <> 最近更新 {new Date(config.updatedAt).toLocaleString("zh-CN")}</>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-[#0969da] px-4 py-2 text-sm font-medium text-white hover:bg-[#0550ae] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "保存中…" : "保存并启用"}
        </button>
      </div>

      {message ? (
        <p className="mb-3 rounded-md border border-[#aceebb] bg-[#dafbe1] px-3 py-2 text-sm text-[#1a7f37]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-md border border-[#ffcecb] bg-[#ffebe9] px-3 py-2 text-sm text-[#cf222e]">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <SlotCard
          title="导览对话"
          desc="用户打开 AI 小智聊天时的主模型；主模型失败时按顺序尝试兜底。"
          enabled={config.chatEnabled}
          onEnabledChange={(chatEnabled) => setConfig((c) => ({ ...c, chatEnabled }))}
        >
          <label className="block text-xs font-medium text-[#656d76]">主模型</label>
          <select
            className={inputCls}
            value={config.chatModelKey}
            onChange={(e) => setConfig((c) => ({ ...c, chatModelKey: e.target.value }))}
          >
            {llmOptions.map((o) => (
              <option key={o.modelKey} value={o.modelKey}>
                {o.label}
              </option>
            ))}
          </select>
          <div>
            <p className="mb-2 text-xs font-medium text-[#656d76]">兜底模型（可多选，按顺序尝试）</p>
            <FallbackPicker
              candidates={llmOptions}
              primary={config.chatModelKey}
              selected={config.chatFallbackModelKeys}
              onChange={(chatFallbackModelKeys) =>
                setConfig((c) => ({ ...c, chatFallbackModelKeys }))
              }
            />
          </div>
        </SlotCard>

        <SlotCard
          title="每日热闻"
          desc="Cron / 管理后台预生成 10 条 AI 热闻时使用的模型。"
          enabled={config.newsEnabled}
          onEnabledChange={(newsEnabled) => setConfig((c) => ({ ...c, newsEnabled }))}
        >
          <label className="block text-xs font-medium text-[#656d76]">主模型</label>
          <select
            className={inputCls}
            value={config.newsModelKey}
            onChange={(e) => setConfig((c) => ({ ...c, newsModelKey: e.target.value }))}
          >
            {llmOptions.map((o) => (
              <option key={o.modelKey} value={o.modelKey}>
                {o.label}
              </option>
            ))}
          </select>
          <div>
            <p className="mb-2 text-xs font-medium text-[#656d76]">兜底模型</p>
            <FallbackPicker
              candidates={llmOptions}
              primary={config.newsModelKey}
              selected={config.newsFallbackModelKeys}
              onChange={(newsFallbackModelKeys) =>
                setConfig((c) => ({ ...c, newsFallbackModelKeys }))
              }
            />
          </div>
        </SlotCard>

        <SlotCard
          title="知识库向量（RAG）"
          desc="导览问答检索 PlatformDocChunk 时的 embedding 模型。"
          enabled={config.embedEnabled}
          onEnabledChange={(embedEnabled) => setConfig((c) => ({ ...c, embedEnabled }))}
        >
          <label className="block text-xs font-medium text-[#656d76]">向量模型</label>
          <select
            className={inputCls}
            value={config.embedModelKey}
            onChange={(e) => {
              const embedModelKey = e.target.value;
              const candidate = initial.embedCandidates.find((c) => c.modelKey === embedModelKey);
              setConfig((c) => ({
                ...c,
                embedModelKey,
                embedDim: candidate?.supportedDims[0] ?? c.embedDim,
              }));
            }}
          >
            {initial.embedCandidates.map((c) => (
              <option key={c.modelKey} value={c.modelKey}>
                {c.displayName} · {c.vendor}
              </option>
            ))}
          </select>
          <label className="block text-xs font-medium text-[#656d76]">向量维度</label>
          <select
            className={inputCls}
            value={config.embedDim}
            onChange={(e) => setConfig((c) => ({ ...c, embedDim: Number(e.target.value) }))}
          >
            {(selectedEmbed?.supportedDims ?? [1024]).map((dim) => (
              <option key={dim} value={dim}>
                {dim}
              </option>
            ))}
          </select>
        </SlotCard>
      </div>
    </div>
  );
}
