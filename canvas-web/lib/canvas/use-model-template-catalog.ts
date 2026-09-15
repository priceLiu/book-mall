"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  fetchModelTemplateCatalog,
  type TemplateCatalog,
} from "@/lib/canvas/model-template-catalog";

/** 启动时拉一次场景模板静态目录（5min 缓存）。 */
export function useModelTemplateCatalog(): {
  catalog: TemplateCatalog | null;
  loading: boolean;
} {
  const base = useBookMallBaseUrl();
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!base) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchModelTemplateCatalog(base).then((c) => {
      if (!cancelled) {
        setCatalog(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [base]);

  return { catalog, loading };
}
