import { randomInt } from "crypto";

import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["PENDING", "AWAITING_CONFIRM"] as const;

/** 生成 6 位数字备注码（活跃单内不重复） */
export async function generateUniqueRemarkCode(maxAttempts = 20): Promise<string> {
  const checkout = prisma.paymentCheckout;
  if (!checkout?.findFirst) {
    throw new Error(
      "支付模块未就绪：请在 book-mall 目录执行 pnpm exec prisma generate && pnpm db:deploy 后重启 dev 服务",
    );
  }

  for (let i = 0; i < maxAttempts; i++) {
    const code = String(randomInt(100000, 1000000));
    const existing = await checkout.findFirst({
      where: { remarkCode: code, status: { in: [...ACTIVE_STATUSES] } },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("备注码生成失败，请重试");
}

export function normalizeRemarkCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}

export function isValidRemarkCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
