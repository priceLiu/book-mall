import type { FetchToolsSessionResult } from "@/lib/tools-introspect";

export function parseToolsSessionPayload(raw: unknown): FetchToolsSessionResult {
  if (!raw || typeof raw !== "object") {
    return {
      hasCookie: false,
      originConfigured: false,
      introspectStatus: null,
      introspect: null,
      active: false,
    };
  }
  const o = raw as Record<string, unknown>;
  const { _diag: _ignored, ...rest } = o;
  return rest as FetchToolsSessionResult;
}
