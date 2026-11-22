import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  createMainImageHitReplicaProject,
  listMainImageHitReplicaSummaries,
} from "@/lib/ecom/main-image-hit-replica/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("summary") === "1") {
      const items = await listMainImageHitReplicaSummaries(auth.userId);
      return ecomJson({ items });
    }
    const items = await listMainImageHitReplicaSummaries(auth.userId);
    return ecomJson({ projects: items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return ecomJson({ error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  try {
    const project = await createMainImageHitReplicaProject(auth.userId, {
      title: typeof body.title === "string" ? body.title : undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return ecomJson({ error: message }, { status: 400 });
  }
}