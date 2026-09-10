import { NextResponse } from "next/server";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import {
  backfillTextTryonResultsToTryonLibrary,
  shanghaiDayBounds,
} from "@/lib/ecom/ecom-text-tryon-tryon-library-backfill";

export const dynamic = "force-dynamic";

/** 将文生试衣历史结果补写入试衣库（默认：今日 · Asia/Shanghai） */
export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { allTime?: boolean } = {};
  try {
    body = (await req.json()) as { allTime?: boolean };
  } catch {
    /* empty body ok */
  }

  const bounds = body.allTime ? undefined : shanghaiDayBounds();
  const result = await backfillTextTryonResultsToTryonLibrary(auth.userId, {
    since: bounds?.start,
    until: bounds?.end,
  });

  return NextResponse.json({ ok: true, ...result });
}
