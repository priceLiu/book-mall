"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchModelCreditsPreview, type ModelCreditsPreview } from "./credits-preview-client";
import {
  estimateCreditsFromCatalogModel,
  fetchModelTemplateCatalog,
  findCatalogModelByModelKey,
} from "./model-template-catalog";

/** Gateway modelKey 归一化为字符串（batchImage / 旧数据可能非 string） */
export function normalizeModelKey(modelKey: unknown): string {
  if (typeof modelKey === "string") return modelKey.trim();
  if (modelKey == null) return "";
  return String(modelKey).trim();
}

function unitsForPreview(opts: {
  durationSec: number;
  imageCount?: number;
  unit?: string;
}): number {
  const u = opts.unit?.toUpperCase() ?? "";
  if (u.includes("IMAGE") || u === "PER_IMAGE") {
    return Math.max(1, opts.imageCount ?? 1);
  }
  if (u.includes("SEC") || u === "PER_SEC") {
    return Math.max(1, Math.round(opts.durationSec || 1));
  }
  return 1;
}

/** 按模型 + 时长/张数估算：优先场景模板静态目录，回退主站 preview API */
export function useModelCreditsPreview(
  modelKey: unknown,
  durationSec: number,
  variantId?: string,
  imageCount?: number,
  resolution?: string,
): ModelCreditsPreview | null {
  const base = useBookMallBaseUrl();
  const [preview, setPreview] = useState<ModelCreditsPreview | null>(null);

  useEffect(() => {
    const key = normalizeModelKey(modelKey);
    if (!key || !base) {
      setPreview(null);
      return;
    }
    let cancelled = false;

    void (async () => {
      const catalog = await fetchModelTemplateCatalog(base);
      const row = findCatalogModelByModelKey(catalog, key);
      if (row && !cancelled) {
        const units = unitsForPreview({
          durationSec,
          imageCount,
          unit: row.unit,
        });
        const credits = estimateCreditsFromCatalogModel(row, units, resolution ?? variantId);
        setPreview({
          credits,
          creditsPerUnit: row.creditsPerUnit,
          unit: row.unit,
          canonicalModelKey: row.canonicalModelKey,
          billingPersona: "PLATFORM_CREDIT",
        });
        return;
      }

      const r = await fetchModelCreditsPreview(base, {
        modelKey: key,
        durationSec,
        variantId,
        imageCount,
        resolution,
      });
      if (!cancelled) setPreview(r);
    })();

    return () => {
      cancelled = true;
    };
  }, [base, modelKey, durationSec, variantId, imageCount, resolution]);

  return preview;
}
