import type { GatewayUserSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 真实邮箱优先；仅手机号时用 `{phone}@phone.book` 作为 Gateway 登录标识 */
export function resolveGatewayUserEmail(opts: {
  email?: string | null;
  phone?: string | null;
}): string | null {
  const email =
    opts.email?.trim().toLowerCase() ||
    (opts.phone?.trim() ? `${opts.phone.trim()}@phone.book` : "");
  return email || null;
}

/** book 注册用户 → GatewayUser（单向同步，不复制密码） */
export async function syncGatewayUserFromBookUser(opts: {
  bookUserId: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  image?: string | null;
}) {
  const email = resolveGatewayUserEmail(opts);
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

/** 从 Book User 表读取身份并同步 GatewayUser（邮箱或手机号均可） */
export async function ensureBookUserGatewayIdentitySynced(bookUserId: string) {
  const bookUser = await prisma.user.findUnique({
    where: { id: bookUserId },
    select: { email: true, phone: true, name: true, image: true },
  });
  if (!bookUser?.email && !bookUser?.phone) {
    throw new Error("Book 用户缺少邮箱或手机号，无法同步 GatewayUser");
  }
  const gw = await syncGatewayUserFromBookUser({
    bookUserId,
    email: bookUser.email,
    phone: bookUser.phone,
    name: bookUser.name,
    image: bookUser.image,
  });
  if (!gw) throw new Error("GatewayUser 同步失败");
  return gw;
}

export async function findGatewayUserByBookUserId(bookUserId: string) {
  return prisma.gatewayUser.findUnique({ where: { bookUserId } });
}

export async function findGatewayUserByEmail(email: string) {
  return prisma.gatewayUser.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}
