import { prisma } from "@/lib/prisma";

/** 容量包入账（Finance SKU 钩子；购买成功后调用） */
export async function grantUserMediaStorage(args: {
  userId: string;
  bytesQuota: bigint;
  expiresAt: Date;
}): Promise<{ id: string }> {
  const row = await prisma.userMediaStorageGrant.create({
    data: {
      userId: args.userId,
      bytesQuota: args.bytesQuota,
      expiresAt: args.expiresAt,
    },
    select: { id: true },
  });
  return row;
}

export async function getActiveMediaStorageGrant(userId: string) {
  return prisma.userMediaStorageGrant.findFirst({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
  });
}
