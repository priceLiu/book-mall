import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const take = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("take") ?? 50)));
  const skip = Math.max(0, Number(request.nextUrl.searchParams.get("skip") ?? 0));

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: user.id } },
    select: { id: true },
  });

  if (!account) {
    return financeJson(request, { rows: [], total: 0 });
  }

  const [rows, total] = await Promise.all([
    prisma.creditLedger.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.creditLedger.count({ where: { accountId: account.id } }),
  ]);

  return financeJson(request, { rows, total });
}
