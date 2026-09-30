import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import {
  createProductImageSetProject,
  listProductImageSetProjects,
  listProductImageSetSummaries,
} from "@/lib/ecom/product-image-set/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get("summary") === "1") {
    const items = await listProductImageSetSummaries(auth.userId);
    return ecomJson({ items });
  }
  const projects = await listProductImageSetProjects(auth.userId);
  return ecomJson({ projects });
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  let body: { title?: string } = {};
  try {
    body = (await req.json()) as { title?: string };
  } catch {
    /* empty */
  }
  const project = await createProductImageSetProject(auth.userId, { title: body.title });
  return ecomJson({ project });
}
