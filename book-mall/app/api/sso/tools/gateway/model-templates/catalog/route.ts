import { NextResponse } from "next/server";

import {
  getLatestTemplateCatalog,
  getTemplateCatalogByVersion,
} from "@/lib/platform-model/scene-templates";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 工具 SSO · 场景模板静态目录（规则 + 平台积分单价 + 路由解析快照）。 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const version = new URL(req.url).searchParams.get("version")?.trim();
  const catalog = version
    ? await getTemplateCatalogByVersion(version)
    : await getLatestTemplateCatalog();

  if (!catalog) {
    return NextResponse.json(
      { ok: false, error: "尚未发布场景模板目录", catalog: null },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { ok: true, catalog },
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    },
  );
}
