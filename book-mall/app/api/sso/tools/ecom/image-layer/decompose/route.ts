import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { startImageLayerDecomposeJob } from "@/lib/ecom/ecom-image-layer-decompose-job";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { validateDecomposeBboxes } from "@/lib/ecom/ecom-image-layer-prompt";
import {
  decomposeImageLayer,
  ECOM_IMAGE_LAYER_MAX_BBOXES,
} from "@/lib/ecom/ecom-image-layer-service";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseBboxes(raw: unknown): Array<[number, number, number, number]> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<[number, number, number, number]> = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const nums = row.slice(0, 4).map((v) => Number(v));
    if (nums.some((n) => !Number.isFinite(n))) continue;
    out.push([nums[0]!, nums[1]!, nums[2]!, nums[3]!]);
  }
  return out.length ? out : undefined;
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "无效 JSON" }, { status: 400 });
  }

  const sourceImageUrl =
    typeof body.sourceImageUrl === "string" ? body.sourceImageUrl.trim() : "";
  if (!sourceImageUrl) {
    return ecomJson({ error: "缺少 sourceImageUrl" }, { status: 400 });
  }

  const size = typeof body.size === "string" ? body.size.trim() : undefined;
  const bboxes = parseBboxes(body.bboxes);
  if (bboxes && bboxes.length > ECOM_IMAGE_LAYER_MAX_BBOXES) {
    return ecomJson(
      { error: `最多 ${ECOM_IMAGE_LAYER_MAX_BBOXES} 个拆分框` },
      { status: 400 },
    );
  }
  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  if (bboxes?.length) {
    try {
      validateDecomposeBboxes(bboxes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "拆分框无效";
      return ecomJson({ error: msg }, { status: 400 });
    }
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "图层拆分失败";
    const status = e instanceof GatewayRequiredError ? e.httpStatus : 502;
    return ecomJson({ error: msg }, { status });
  }

  // 有项目时立刻返回，分离在进程内后台完成。公网云托管约 60s 会把长请求打成 504。
  if (projectId) {
    try {
      const job = await startImageLayerDecomposeJob({
        userId: auth.userId,
        projectId,
        sourceImageUrl,
        bboxes,
        size,
      });
      return ecomJson(
        { accepted: true, jobId: job.jobId, status: job.status },
        { status: 202 },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "图层拆分失败";
      const status = msg === "项目不存在" ? 404 : 502;
      return ecomJson({ error: msg }, { status });
    }
  }

  try {
    const stack = await decomposeImageLayer({
      userId: auth.userId,
      sourceImageUrl,
      bboxes,
      size,
    });
    return ecomJson({ stack });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "图层拆分失败";
    return ecomJson({ error: msg }, { status: 502 });
  }
}
