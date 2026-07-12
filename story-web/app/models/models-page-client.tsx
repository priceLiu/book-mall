"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Star } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  fetchEngineModels,
  fetchModelConfig,
  patchModelConfig,
  type StoryEngineModel,
  type StoryModelSelection,
} from "@/lib/story-api";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  LLM: "剧本 / 文案（LLM）",
  IMAGE: "分镜 / 角色图（IMAGE）",
  VIDEO: "成片 / 镜头（VIDEO）",
};

export function ModelsPageClient() {
  const base = useBookMallBaseUrl();
  const [catalog, setCatalog] = useState<StoryEngineModel[]>([]);
  const [billingPersona, setBillingPersona] = useState<"PLATFORM_CREDIT" | "BYOK" | null>(null);
  const [selections, setSelections] = useState<StoryModelSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [engine, config] = await Promise.all([
          fetchEngineModels(base),
          fetchModelConfig(base),
        ]);
        if (cancelled) return;
        setCatalog(engine.models);
        setBillingPersona(engine.billingPersona);
        setSelections(config.selections);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base]);

  const byRole = useMemo(() => {
    const map = new Map<string, StoryEngineModel[]>();
    for (const m of catalog) {
      const list = map.get(m.role) ?? [];
      list.push(m);
      map.set(m.role, list);
    }
    return map;
  }, [catalog]);

  const selectionMap = useMemo(() => {
    return new Map(selections.map((s) => [s.engineModelId, s]));
  }, [selections]);

  const applyUpdate = async (
    engineModelId: string,
    patch: { enabled?: boolean; isPrimary?: boolean },
  ) => {
    if (!base) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await patchModelConfig(base, [{ engineModelId, ...patch }]);
      setSelections(result.selections);
      setMessage("已保存");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="story-shell-page flex items-center justify-center gap-2 py-24 text-[var(--story-muted)]">
        <Loader2 className="size-5 animate-spin" />
        加载模型配置…
      </div>
    );
  }

  if (error && selections.length === 0) {
    return (
      <div className="story-shell-page py-16 text-center">
        <p className="text-red-400">{error}</p>
        <p className="mt-2 text-sm text-[var(--story-muted)]">
          请先在顶部栏登录 book-mall 账号。
        </p>
        <Link href="/" className="twenty-btn-ghost mt-6 inline-flex">
          回到首页
        </Link>
      </div>
    );
  }

  return (
    <div className="story-shell-page py-12 sm:py-16">
      <div className="max-w-3xl">
        <h1 className="story-serif text-3xl text-white">模型配置</h1>
        <p className="twenty-body mt-2">
          为漫剧空间选择 AI 引擎。已预置 Gemini、Nano Banana（香蕉模型）、通义万相、Veo、可灵等主流模型；每个类别可指定一个主模型。
        </p>
      </div>

      <div className="mt-10 space-y-10">
        {["LLM", "IMAGE", "VIDEO"].map((role) => (
          <section key={role}>
            <h2 className="story-sans text-lg font-semibold text-white">{ROLE_LABEL[role] ?? role}</h2>
            <ul className="mt-4 space-y-3">
              {(byRole.get(role) ?? []).map((model) => {
                const sel = selectionMap.get(model.id);
                const enabled = sel?.enabled ?? false;
                const isPrimary = sel?.isPrimary ?? false;
                return (
                  <li
                    key={model.id}
                    className={cn(
                      "rounded-lg border border-white/10 bg-[var(--story-surface)] p-4 sm:p-5",
                      enabled && "ring-1 ring-[var(--story-accent)]/40",
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-white">{model.displayName}</h3>
                          {billingPersona !== "PLATFORM_CREDIT" ? (
                            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--story-muted)]">
                              {model.vendor}
                            </span>
                          ) : null}
                          {isPrimary ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
                              <Star className="size-3" fill="currentColor" />
                              主模型
                            </span>
                          ) : null}
                        </div>
                        {model.description ? (
                          <p className="mt-1 text-sm text-[var(--story-muted)]">{model.description}</p>
                        ) : null}
                        <p className="mt-1 font-mono text-xs text-[var(--story-muted)]">{model.modelKey}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => applyUpdate(model.id, { enabled: !enabled })}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm",
                            enabled
                              ? "border-white bg-white text-black"
                              : "border-white/15 text-white hover:bg-white/5",
                          )}
                        >
                          {enabled ? (
                            <>
                              <Check className="mr-1 inline size-3.5" />
                              已启用
                            </>
                          ) : (
                            "启用"
                          )}
                        </button>
                        {enabled ? (
                          <button
                            type="button"
                            disabled={saving || isPrimary}
                            onClick={() => applyUpdate(model.id, { isPrimary: true })}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/5 disabled:opacity-50"
                          >
                            设为主模型
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {message ? <p className="mt-6 text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {saving ? (
        <p className="mt-2 text-xs text-[var(--story-muted)]">保存中…</p>
      ) : null}
    </div>
  );
}
