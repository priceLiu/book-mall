import { NextResponse } from "next/server";

import { prepareWanxSubjectCutout } from "@/lib/ecom/ecom-background-replace-service";
import { formatEcomImageProcessingUserError } from "@/lib/ecom/ecom-image-processing-error";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const sourceImageUrl =
    typeof body.sourceImageUrl === "string"
      ? body.sourceImageUrl.trim()
      : typeof body.baseImageUrl === "string"
        ? body.baseImageUrl.trim()
        : "";
  if (!sourceImageUrl) {
    return NextResponse.json({ error: "缺少主体图 sourceImageUrl" }, { status: 400 });
  }

  try {
    const cutoutUrl = await prepareWanxSubjectCutout(auth.userId, sourceImageUrl);
    return NextResponse.json({ cutoutUrl });
  } catch (e) {
    const { message, status } = formatEcomImageProcessingUserError(e);
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 502 });
  }
}
