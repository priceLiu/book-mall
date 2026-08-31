export type EcomCatalogScope = "platform" | "user";

export type EcomCatalogEntryBase = {
  id: string;
  scope?: EcomCatalogScope;
  userId?: string | null;
  lockedAt?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export function isPlatformCatalogEntry(entry: EcomCatalogEntryBase): boolean {
  return (entry.scope ?? "platform") === "platform";
}

export function isUserCatalogEntry(entry: EcomCatalogEntryBase, userId: string): boolean {
  return entry.scope === "user" && entry.userId === userId;
}

export function isCatalogEntryLocked(entry: EcomCatalogEntryBase): boolean {
  return Boolean(entry.lockedAt);
}
