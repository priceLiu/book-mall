"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  EcomStylePresetKind,
  EcomStylePresetListResponse,
  EcomStylePresetVertical,
} from "@/lib/ecom-style-preset-types";

const BASE = "api/sso/tools/ecom/style-presets";

export async function fetchEcomStylePresets(opts: {
  kind: EcomStylePresetKind;
  vertical?: EcomStylePresetVertical;
  seed?: string;
  limit?: number;
  suggest?: boolean;
}): Promise<EcomStylePresetListResponse> {
  const q = new URLSearchParams();
  q.set("kind", opts.kind);
  q.set("vertical", opts.vertical ?? "generic");
  if (opts.seed) q.set("seed", opts.seed);
  if (opts.limit != null) q.set("limit", String(opts.limit));
  if (opts.suggest) q.set("suggest", "1");
  const data = await ecomBookFetch(`${BASE}?${q.toString()}`);
  return data as EcomStylePresetListResponse;
}
