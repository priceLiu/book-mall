import { NextRequest, NextResponse } from "next/server";

import {
  readLoggingFuseConfigForAdmin,
  updateLoggingFuseConfig,
} from "@/lib/admin/logging-fuse-config-service";
import { requireAdminSession } from "@/lib/admin/generation-quota-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const config = await readLoggingFuseConfigForAdmin();
  return NextResponse.json({ config });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: {
    modelDailyLimit?: number;
    modelDailyLimitOverrides?: Record<string, number>;
    vendorDirectBlockHosts?: string[];
    usageReconEnabled?: boolean;
    usageReconIntervalMin?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const config = await updateLoggingFuseConfig(body);
    return NextResponse.json({ config });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
