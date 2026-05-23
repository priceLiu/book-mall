"use client";

import { useCallback, useEffect, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listCanvasPromptTemplates,
  type CanvasPromptEngineKind,
  type CanvasPromptTemplateRecord,
} from "@/lib/canvas-prompt-templates-api";

/** 缓存 + 拉取用户可见的提示词模板（内置 + 自定义） */
export function usePromptTemplates(engine: CanvasPromptEngineKind) {
  const base = useBookMallBaseUrl();
  const [templates, setTemplates] = useState<CanvasPromptTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const list = await listCanvasPromptTemplates(base, engine);
      setTemplates(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base, engine]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { templates, loading, error, reload };
}
