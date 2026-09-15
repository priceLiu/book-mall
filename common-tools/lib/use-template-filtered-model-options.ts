"use client";

import { useEffect, useMemo, useState } from "react";
import {
  commonToolsModelKeysForTemplates,
  fetchCommonToolsModelTemplateCatalog,
  filterOptionsByTemplateKeys,
} from "@/lib/model-template-catalog";

/** 按场景模板过滤静态 modelOptions（目录不可达时保留原列表）。 */
export function useTemplateFilteredModelOptions<T extends { id: string }>(
  options: readonly T[],
  templateIds: readonly string[],
): T[] {
  const templateKey = templateIds.join("|");
  const [allowed, setAllowed] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ids = templateKey.split("|").filter(Boolean);
    void fetchCommonToolsModelTemplateCatalog().then((catalog) => {
      if (cancelled) return;
      const keys = commonToolsModelKeysForTemplates(catalog, ids);
      setAllowed(keys.size > 0 ? keys : null);
    });
    return () => {
      cancelled = true;
    };
  }, [templateKey]);

  return useMemo(() => {
    if (!allowed) return [...options];
    return filterOptionsByTemplateKeys(options, allowed);
  }, [options, allowed]);
}
