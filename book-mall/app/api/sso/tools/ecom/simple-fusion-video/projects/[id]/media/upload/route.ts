import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  uploadSimpleFusionComposeClip,
  uploadSimpleFusionImage,
} from "@/lib/ecom/simple-fusion-video/service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  const slotRaw = form.get("slot");
  const slot =
    slotRaw === "model" || slotRaw === "scene" || slotRaw === "garment"
      ? slotRaw
      : slotRaw === "compose-clip"
        ? slotRaw
        : null;
  if (!(file instanceof File) || !slot) {
    return ecomJson({ error: "请指定 slot（model / scene / garment / compose-clip）" }, { status: 400 });
  }
  const firstOrigin =
    typeof form.get("firstOrigin") === "string" ? String(form.get("firstOrigin")) : undefined;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project =
      slot === "compose-clip"
        ? await uploadSimpleFusionComposeClip(auth.userId, id, file)
        : await uploadSimpleFusionImage(auth.userId, id, slot, file, firstOrigin);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return ecomJson({ error: message }, { status: message.includes("不存在") ? 404 : 400 });
  }
}
