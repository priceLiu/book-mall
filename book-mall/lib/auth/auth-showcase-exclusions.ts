import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";

/** 平台 Pilot / 管理员测试帐号（门户墙可展示，登录注册左栏默认排除） */
const DEFAULT_EXCLUDED_OWNER_EMAILS = ["13808816802@126.com"];
const DEFAULT_EXCLUDED_OWNER_NAMES = ["pilot"];

function parseCsvEnv(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function excludedEmails(): Set<string> {
  const fromEnv = parseCsvEnv(process.env.AUTH_SHOWCASE_EXCLUDED_OWNER_EMAILS);
  const list = fromEnv.length > 0 ? fromEnv : DEFAULT_EXCLUDED_OWNER_EMAILS;
  return new Set(list.map((e) => e.toLowerCase()));
}

function excludedNames(): Set<string> {
  const fromEnv = parseCsvEnv(process.env.AUTH_SHOWCASE_EXCLUDED_OWNER_NAMES);
  const list = fromEnv.length > 0 ? fromEnv : DEFAULT_EXCLUDED_OWNER_NAMES;
  return new Set(list.map((n) => n.toLowerCase()));
}

function excludedIds(): Set<string> {
  return new Set(parseCsvEnv(process.env.AUTH_SHOWCASE_EXCLUDED_OWNER_IDS));
}

export function isAuthShowcaseExcludedOwner(
  owner: PortalFilmShowcaseMedia["owner"],
): boolean {
  if (!owner) return false;
  const id = owner.id?.trim();
  if (id && excludedIds().has(id)) return true;

  const email = owner.email?.trim().toLowerCase();
  if (email && excludedEmails().has(email)) return true;

  const name = owner.name?.trim().toLowerCase();
  if (name && excludedNames().has(name)) return true;

  return false;
}

/** 登录/注册左栏：过滤指定作者案例（不影响门户影视案例墙） */
export function filterPortalFilmShowcaseForAuth(
  items: PortalFilmShowcaseMedia[],
): PortalFilmShowcaseMedia[] {
  return items.filter((item) => !isAuthShowcaseExcludedOwner(item.owner));
}