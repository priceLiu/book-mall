import { NextResponse } from "next/server";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import {
  deleteEcomGenerationRecord,
  listEcomGenerationRecords,
} from "@/lib/ecom/ecom-generation-record";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const items = await listEcomGenerationRecords(auth.userId);
  return NextResponse.json({
    items: items.map((row) => ({
      id: row.id,
      module: row.module,
      kind: row.kind,
      title: row.title,
      prompt: row.prompt,
      ossUrl: row.ossUrl,
      thumbnailUrl: row.thumbnailUrl,
      meta: row.meta,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  try {
    await deleteEcomGenerationRecord(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message.includes("未找到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
