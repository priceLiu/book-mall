import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  getStylePresetRowFromDb,
  patchStylePresetEntry,
  softDeleteStylePresetEntry,
} from "@/lib/ecom/ecom-style-preset/db-service";
import { invalidateStylePresetCache } from "@/lib/ecom/ecom-style-preset/runtime";
import type { EcomStylePresetVertical } from "@/lib/ecom/ecom-style-preset/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function parseVerticals(raw: unknown): EcomStylePresetVertical[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const allowed = new Set<EcomStylePresetVertical>([
    "fashion_apparel",
    "bags",
    "digital_3c",
    "generic",
  ]);
  return raw.filter((x): x is EcomStylePresetVertical => typeof x === "string" && allowed.has(x as EcomStylePresetVertical));
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const existing = await getStylePresetRowFromDb(id);
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const saved = await patchStylePresetEntry(id, {
    title: typeof body.title === "string" ? body.title.trim() : undefined,
    subtitle:
      typeof body.subtitle === "string"
        ? body.subtitle.trim()
        : body.subtitle === null
          ? null
          : undefined,
    layoutPrompt:
      typeof body.layoutPrompt === "string"
        ? body.layoutPrompt
        : body.layoutPrompt === null
          ? null
          : undefined,
    thumbUrl:
      typeof body.thumbUrl === "string"
        ? body.thumbUrl
        : body.thumbUrl === null
          ? null
          : undefined,
    referenceUrl:
      typeof body.referenceUrl === "string"
        ? body.referenceUrl
        : body.referenceUrl === null
          ? null
          : undefined,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    verticals: parseVerticals(body.verticals),
  });
  invalidateStylePresetCache();
  return NextResponse.json({ preset: saved });
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const ok = await softDeleteStylePresetEntry(id);
  if (!ok) return NextResponse.json({ error: "不存在" }, { status: 404 });
  invalidateStylePresetCache();
  return NextResponse.json({ ok: true });
}
