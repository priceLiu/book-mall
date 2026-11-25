import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { readSellingDecomposeIndex } from "@/lib/ecom/ecom-selling-poster-decompose";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 已入库的贴纸编号。进程内缓存，版本没变就空响应。 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  let index: Awaited<ReturnType<typeof readSellingDecomposeIndex>>;
  try {
    index = await readSellingDecomposeIndex(req.headers.get("if-none-match"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "拆层清单加载失败";
    return ecomJson({ error: message }, { status: 500 });
  }
  if (index.notModified) {
    return new Response(null, {
      status: 304,
      headers: { ETag: `"${index.rev}"` },
    });
  }
  return ecomJson(
    { rev: index.rev, ids: index.ids },
    { headers: { ETag: `"${index.rev}"` } },
  );
}
