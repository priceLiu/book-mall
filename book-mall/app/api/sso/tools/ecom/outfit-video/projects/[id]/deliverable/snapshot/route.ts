import { NextResponse } from "next/server";

import { getEcomOutfitVideoProject } from "@/lib/ecom/ecom-outfit-video-service";
import {
  buildOutfitVideoDeliverableSnapshotTitle,
  saveOutfitVideoDeliverableSnapshot,
} from "@/lib/ecom/ecom-outfit-video-snapshot";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let workName = "";
  try {
    const body = (await req.json()) as { workName?: string };
    workName = typeof body.workName === "string" ? body.workName.trim() : "";
  } catch {
    /* empty */
  }

  try {
    const project = await getEcomOutfitVideoProject(auth.userId, id);
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

    const title = buildOutfitVideoDeliverableSnapshotTitle(
      workName || project.title || "穿搭视频",
    );
    const snapshot = await saveOutfitVideoDeliverableSnapshot(auth.userId, id, title);
    return NextResponse.json({ snapshot, title });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
