import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { GenerationSubmitTier } from "@prisma/client";
import { authOptions } from "@/lib/auth";

export async function requireAdminSession(): Promise<
  | { ok: true }
  | { ok: false; res: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return {
      ok: false,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true };
}

export function parseGenerationSubmitTier(
  value: unknown,
): GenerationSubmitTier | null {
  if (value === "STANDARD" || value === "ELEVATED" || value === "HEAVY") {
    return value;
  }
  return null;
}

export function parseBurstOverride(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 500) return null;
  return Math.floor(n);
}
