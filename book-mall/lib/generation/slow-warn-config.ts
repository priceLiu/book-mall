/**
 * 生成耗时预警阈值：PlatformConfig（轮询池可调）> 环境变量 > 默认 800s。
 */
import { prisma } from "@/lib/prisma";

import { getGenerationSlowWarnMs } from "./poll-config";

const CACHE_TTL_MS = 30_000;
let cachedSec: number | null = null;
let cachedAt = 0;

function envSlowWarnSec(): number {
  return Math.max(60, Math.round(getGenerationSlowWarnMs() / 1000));
}

export function invalidateGenerationSlowWarnCache(): void {
  cachedSec = null;
  cachedAt = 0;
}

export async function resolveGenerationSlowWarnSec(): Promise<number> {
  const now = Date.now();
  if (cachedSec != null && now - cachedAt < CACHE_TTL_MS) {
    return cachedSec;
  }
  try {
    const row = await prisma.platformConfig.findUnique({
      where: { id: "default" },
      select: { generationSlowWarnSec: true },
    });
    const sec = row?.generationSlowWarnSec;
    if (typeof sec === "number" && sec >= 60 && sec <= 7200) {
      cachedSec = sec;
      cachedAt = now;
      return sec;
    }
  } catch {
    /* fallback */
  }
  const fallback = envSlowWarnSec();
  cachedSec = fallback;
  cachedAt = now;
  return fallback;
}

export async function resolveGenerationSlowWarnMs(): Promise<number> {
  return (await resolveGenerationSlowWarnSec()) * 1000;
}

export async function updateGenerationSlowWarnSec(
  sec: number,
): Promise<number> {
  const clamped = Math.min(7200, Math.max(60, Math.round(sec)));
  await prisma.platformConfig.upsert({
    where: { id: "default" },
    create: { id: "default", generationSlowWarnSec: clamped },
    update: { generationSlowWarnSec: clamped },
  });
  invalidateGenerationSlowWarnCache();
  return clamped;
}

export async function readGenerationSlowWarnConfig(): Promise<{
  slowWarnSec: number;
  slowWarnMs: number;
  source: "platform" | "env";
}> {
  try {
    const row = await prisma.platformConfig.findUnique({
      where: { id: "default" },
      select: { generationSlowWarnSec: true },
    });
    if (
      typeof row?.generationSlowWarnSec === "number" &&
      row.generationSlowWarnSec >= 60
    ) {
      return {
        slowWarnSec: row.generationSlowWarnSec,
        slowWarnMs: row.generationSlowWarnSec * 1000,
        source: "platform",
      };
    }
  } catch {
    /* fallback */
  }
  const sec = envSlowWarnSec();
  return { slowWarnSec: sec, slowWarnMs: sec * 1000, source: "env" };
}
