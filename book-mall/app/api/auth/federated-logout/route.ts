import { NextRequest, NextResponse } from "next/server";

import {
  buildFederatedLogoutStepUrl,
  listFederatedToolsLogoutOrigins,
  resolveBookMallCallbackUrl,
  shouldUseFederatedToolsLogoutChain,
} from "@/lib/federated-tools-logout";

export const dynamic = "force-dynamic";

function safeFinalCallback(raw: string | null): string {
  if (!raw?.trim()) return "/";
  const t = raw.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  return t;
}

/** 子站 tools-logout 链（无 Set-Cookie，可安全 302 到外站）。 */
export async function GET(request: NextRequest) {
  const stepRaw = Number(request.nextUrl.searchParams.get("step") ?? "0");
  const step =
    Number.isFinite(stepRaw) && stepRaw >= 0 ? Math.floor(stepRaw) : 0;
  const finalUrl = resolveBookMallCallbackUrl(
    safeFinalCallback(request.nextUrl.searchParams.get("final")),
    request.nextUrl.origin,
  );

  if (!shouldUseFederatedToolsLogoutChain()) {
    return NextResponse.redirect(finalUrl, 302);
  }

  const origins = listFederatedToolsLogoutOrigins();
  if (step >= origins.length) {
    return NextResponse.redirect(finalUrl, 302);
  }

  const book =
    trimBookOrigin(resolveBookMallCallbackUrl("/", request.nextUrl.origin)) ??
    trimBookOrigin(request.nextUrl.origin);
  if (!book) {
    return NextResponse.redirect(finalUrl, 302);
  }

  const nextStep = buildFederatedLogoutStepUrl(step + 1, finalUrl, book);
  const hop = new URL("/api/tools-logout", origins[step]!);
  hop.searchParams.set("next", nextStep);
  return NextResponse.redirect(hop.toString(), 302);
}

function trimBookOrigin(raw: string): string | null {
  const v = raw.trim().replace(/\/$/, "");
  return v.startsWith("http") ? v : null;
}
