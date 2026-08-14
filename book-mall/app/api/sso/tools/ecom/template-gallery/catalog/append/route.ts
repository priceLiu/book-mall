import { NextResponse } from "next/server";

import {
  appendTemplateGalleryEntries,
  type EcomTemplateGalleryEntry,
} from "@/lib/ecom/ecom-template-gallery-service";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type AppendBody = {
  entries?: EcomTemplateGalleryEntry[];
};

/** 追加 catalog 条目（admin only） */
export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  const elig = await getToolsSsoEligibility(auth.userId);
  if (!elig.isAdmin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  let body: AppendBody;
  try {
    body = (await req.json()) as AppendBody;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const entries = body.entries ?? [];
  if (entries.length === 0) {
    return NextResponse.json({ error: "entries 不能为空" }, { status: 400 });
  }

  try {
    const catalog = appendTemplateGalleryEntries(entries);
    return NextResponse.json({ ok: true, total: catalog.templates.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "写入失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
