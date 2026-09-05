import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta } from "@/lib/gateway/gateway-v1-log-meta";
import {
  GatewayV1AsrError,
  runGatewayV1AsrTranscribe,
} from "@/lib/gateway/gateway-v1-asr-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    fileUrl?: string;
    audioUrl?: string;
    model?: string;
    modelKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fileUrl = String(body.fileUrl ?? body.audioUrl ?? "").trim();
  const model = body.model?.trim() || body.modelKey?.trim();

  try {
    const result = await runGatewayV1AsrTranscribe({
      auth,
      fileUrl,
      model,
      logMeta,
    });
    return NextResponse.json({
      code: 200,
      data: { segments: result.segments },
      logId: result.logId,
      providerKind: "DASHSCOPE",
    });
  } catch (e) {
    if (e instanceof GatewayV1AsrError) {
      return NextResponse.json(
        { error: e.message, logId: e.logId },
        { status: e.status },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ASR failed" },
      { status: 502 },
    );
  }
}
