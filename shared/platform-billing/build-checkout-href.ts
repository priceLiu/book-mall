/**
 * 平台结账深链（book-mall 单 writer）
 */

const DEFAULT_PACK_ID = "pack-light";

function trimSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/** 校验 returnTo：仅允许 https? 绝对 URL 或站内 path */
export function sanitizeCheckoutReturnTo(
  raw: string | null | undefined,
  allowedOrigins: string[],
): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) {
    if (v.includes("\n") || v.includes("\r")) return null;
    return v;
  }
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const origin = `${u.protocol}//${u.host}`;
    if (!allowedOrigins.some((o) => trimSlash(o) === origin)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function buildTopupHref(input: {
  bookOrigin: string;
  packId?: string;
  returnTo?: string | null;
  allowedOrigins?: string[];
}): string {
  const base = trimSlash(input.bookOrigin);
  const params = new URLSearchParams();
  params.set("packId", input.packId ?? DEFAULT_PACK_ID);
  const safe = sanitizeCheckoutReturnTo(
    input.returnTo,
    input.allowedOrigins ?? [base],
  );
  if (safe) params.set("returnTo", safe);
  return `${base}/checkout/topup?${params.toString()}`;
}

export function buildMembershipCheckoutHref(input: {
  bookOrigin: string;
  planId: string;
  seats?: number;
  returnTo?: string | null;
  allowedOrigins?: string[];
}): string {
  const base = trimSlash(input.bookOrigin);
  const params = new URLSearchParams();
  params.set("planId", input.planId);
  if (input.seats != null && input.seats > 0) {
    params.set("seats", String(input.seats));
  }
  const safe = sanitizeCheckoutReturnTo(
    input.returnTo,
    input.allowedOrigins ?? [base],
  );
  if (safe) params.set("returnTo", safe);
  return `${base}/checkout/membership?${params.toString()}`;
}

export function resolveCheckoutSuccessRedirect(
  returnTo: string | null | undefined,
  fallback: string,
): string {
  return sanitizeCheckoutReturnTo(returnTo, []) ?? fallback;
}
