/**
 * 厂商 HTTP Request ID（排障用，非异步 task id）。
 */

const REQUEST_ID_IN_TEXT_RE =
  /(?:Request\s*ID|request_id|requestId)\s*[:=]\s*([A-Za-z0-9-]+)/i;

export function extractVendorRequestIdFromText(
  text: string | null | undefined,
): string | null {
  if (!text?.trim()) return null;
  const m = text.match(REQUEST_ID_IN_TEXT_RE);
  return m?.[1]?.trim() || null;
}

export function readVendorRequestIdFromHeaders(
  headers: Headers,
): string | null {
  for (const name of [
    "x-request-id",
    "x-tt-logid",
    "x-tt-trace-id",
    "request-id",
  ]) {
    const v = headers.get(name)?.trim();
    if (v) return v;
  }
  return null;
}

export function readVendorRequestIdFromJson(
  json: unknown,
): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  for (const key of ["request_id", "RequestId", "requestId"]) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const err = o.error;
  if (err && typeof err === "object") {
    const msg = (err as { message?: string }).message;
    const fromMsg = extractVendorRequestIdFromText(msg);
    if (fromMsg) return fromMsg;
  }
  if (typeof o.message === "string") {
    const fromMsg = extractVendorRequestIdFromText(o.message);
    if (fromMsg) return fromMsg;
  }
  return null;
}

export function resolveGatewayLogVendorRequestId(input: {
  vendorRequestId?: string | null;
  failMessage?: string | null;
}): string | null {
  const stored = input.vendorRequestId?.trim();
  if (stored) return stored;
  return extractVendorRequestIdFromText(input.failMessage);
}
