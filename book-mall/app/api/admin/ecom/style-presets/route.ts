import { NextResponse } from "next/server";

import { pickUploadExt } from "@/lib/admin/media-upload";
import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { listStylePresetRowsFromDb } from "@/lib/ecom/ecom-style-preset/db-service";
import { mapStylePresetRow } from "@/lib/ecom/ecom-style-preset/db-mapper";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "sellpoint_layout";
  try {
    const rows = await listStylePresetRowsFromDb({
      kind: kind === "trending_visual" ? "trending_visual" : "sellpoint_layout",
      includeDisabled: true,
    });
    const presets = rows.map((row) => ({
      ...mapStylePresetRow(row),
      enabled: row.enabled,
    }));
    return NextResponse.json({ presets });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "加载失败", presets: [] },
      { status: 500 },
    );
  }
}
