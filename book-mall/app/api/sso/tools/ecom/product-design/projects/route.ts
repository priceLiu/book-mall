import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  createProductDesignProject,
  listProductDesignProjectSummaries,
  type ProductDesignStrategyImport,
} from "@/lib/ecom/ecom-product-design-service";
import { normalizeEcomProjectModule } from "@/lib/ecom/ecom-product-design-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const params = new URL(req.url).searchParams;
    const module = normalizeEcomProjectModule(params.get("module"));
    const items = await listProductDesignProjectSummaries(auth.userId, module, {
      detailed: params.get("detailed") === "1",
    });
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseStrategyImport(raw: unknown): ProductDesignStrategyImport | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { projectId, productRefs, mainImagesAsStyleRefs } = raw as Record<
    string,
    unknown
  >;
  if (typeof projectId !== "string" || !projectId.trim()) return undefined;
  return {
    projectId: projectId.trim(),
    productRefs: productRefs !== false,
    mainImagesAsStyleRefs: mainImagesAsStyleRefs === true,
  };
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty body allowed */
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await createProductDesignProject(auth.userId, {
      module: normalizeEcomProjectModule(body.module),
      title: typeof body.title === "string" ? body.title : undefined,
      platform: typeof body.platform === "string" ? body.platform : undefined,
      brief:
        body.brief && typeof body.brief === "object"
          ? (body.brief as Record<string, unknown>)
          : undefined,
      importFrom: parseStrategyImport(body.importFrom),
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
