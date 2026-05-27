import type { GatewayUserSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** book 注册用户 → GatewayUser（单向同步，不复制密码） */
export async function syncGatewayUserFromBookUser(opts: {
  bookUserId: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const email = opts.email.trim().toLowerCase();
  if (!email) return null;

  return prisma.gatewayUser.upsert({
    where: { bookUserId: opts.bookUserId },
    create: {
      email,
      bookUserId: opts.bookUserId,
      name: opts.name?.trim() || null,
      image: opts.image?.trim() || null,
      source: "BOOK_SYNC" satisfies GatewayUserSource,
    },
    update: {
      email,
      name: opts.name?.trim() || null,
      image: opts.image?.trim() || null,
    },
  });
}

export async function findGatewayUserByBookUserId(bookUserId: string) {
  return prisma.gatewayUser.findUnique({ where: { bookUserId } });
}

export async function findGatewayUserByEmail(email: string) {
  return prisma.gatewayUser.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}
