import type { Prisma } from "@prisma/client";

import { normalizePhone } from "@/lib/auth/phone";

export const ADMIN_USERS_DEFAULT_TAKE = 200;
export const ADMIN_USERS_SEARCH_TAKE = 100;

export function buildAdminUsersListWhere(args: {
  phone?: string | null;
  name?: string | null;
}): Prisma.UserWhereInput | undefined {
  const phoneRaw = args.phone?.trim() ?? "";
  const nameRaw = args.name?.trim() ?? "";
  const and: Prisma.UserWhereInput[] = [];

  if (phoneRaw) {
    const normalized = normalizePhone(phoneRaw);
    if (normalized) {
      and.push({ phone: normalized });
    } else {
      const digits = phoneRaw.replace(/\D/g, "");
      if (digits.length > 0) {
        and.push({ phone: { contains: digits } });
      }
    }
  }

  if (nameRaw) {
    and.push({ name: { contains: nameRaw, mode: "insensitive" } });
  }

  if (and.length === 0) return undefined;
  return and.length === 1 ? and[0]! : { AND: and };
}

export function adminUsersListTake(hasFilter: boolean): number {
  return hasFilter ? ADMIN_USERS_SEARCH_TAKE : ADMIN_USERS_DEFAULT_TAKE;
}
