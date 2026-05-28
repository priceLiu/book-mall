import { prisma } from "@/lib/prisma";

/** 第三方 client 允许的 navKey 子集；空数组表示不额外限制（仍须用户自身服务期）。 */
export function intersectNavKeysWithSsoClient(
  userNavKeys: string[],
  allowedNavKeys: string[],
): string[] {
  if (!allowedNavKeys.length) return userNavKeys;
  const allowed = new Set(allowedNavKeys.map((k) => k.trim()).filter(Boolean));
  return userNavKeys.filter((k) => allowed.has(k));
}

export function userNavKeysOverlapSsoClient(
  userNavKeys: string[],
  allowedNavKeys: string[],
): boolean {
  if (!allowedNavKeys.length) return userNavKeys.length > 0;
  const allowed = new Set(allowedNavKeys.map((k) => k.trim()).filter(Boolean));
  return userNavKeys.some((k) => allowed.has(k));
}

export async function loadActiveSsoClient(clientId: string) {
  const id = clientId.trim();
  if (!id) return null;
  const client = await prisma.ssoClient.findUnique({ where: { clientId: id } });
  if (!client?.active) return null;
  return client;
}
