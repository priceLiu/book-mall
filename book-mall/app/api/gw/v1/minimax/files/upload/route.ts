import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta, logMetaToRequestLogFields } from "@/lib/gateway/gateway-v1-log-meta";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
  mapGatewayPreCreateLogError,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import {
  forwardMinimaxFileUpload,
  type MinimaxFileUploadPurpose,
} from "@/lib/gateway/minimax-speech-proxy";

export const dynamic = "force-dynamic";

const ALLOWED_PURPOSES = new Set<MinimaxFileUploadPurpose>(["voice_clone", "prompt_audio"]);

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    return NextResponse.json({ error: "No MINIMAX credential bound" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form" }, { status: 400 });
  }

  const purposeRaw = String(form.get("purpose") ?? "voice_clone").trim();
  if (!ALLOWED_PURPOSES.has(purposeRaw as MinimaxFileUploadPurpose)) {
    return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  }
  const purpose = purposeRaw as MinimaxFileUploadPurpose;

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const filename =
    file instanceof File && file.name.trim() ? file.name.trim() : `${purpose}.mp3`;
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }

  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model: "MiniMax/file-upload",
      endpoint: "/v1/files/upload",
      providerKind: "MINIMAX",
      requestKind: "OTHER",
      clientSource,
      inputSummary: buildGatewayInputSummary("MiniMax/file-upload", {
        purpose,
        filename,
        bytes: buffer.length,
      }),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    const result = await forwardMinimaxFileUpload({
      credentialId,
      buffer,
      filename,
      purpose,
    });
    const ok = result.status >= 200 && result.status < 300 && result.fileId > 0;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      resultSummary: ok ? { file_id: result.fileId } : undefined,
      failMessage: ok ? undefined : `MiniMax file upload failed (${result.status})`,
      model: "MiniMax/file-upload",
    });
    if (!ok) {
      return NextResponse.json(
        { error: "MiniMax file upload failed", logId: log.id, vendor: result.vendorJson },
        { status: 502 },
      );
    }
    return NextResponse.json({
      file_id: result.fileId,
      logId: log.id,
    });
  } catch (e) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failMessage: (e as Error).message,
      model: "MiniMax/file-upload",
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
