import { ModelAliasSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * v003：把"某来源的别名字串"解析为标准模型名（canonicalKey）。
 * 命中 active 别名且其 catalogId.active === true 才返回；否则返回 null。
 */
export async function canonicalKeyForAlias(input: {
  source: ModelAliasSource;
  aliasValue: string;
}): Promise<string | null> {
  const v = input.aliasValue.trim();
  if (!v) return null;
  const a = await prisma.modelAlias.findUnique({
    where: { source_aliasValue: { source: input.source, aliasValue: v } },
    select: { active: true, catalog: { select: { canonicalKey: true, active: true } } },
  });
  if (!a || !a.active) return null;
  if (!a.catalog || !a.catalog.active) return null;
  return a.catalog.canonicalKey;
}

/**
 * 批量版（对账聚合时用）：传入 (source, aliasValue)[]，返回 Map。
 * 单查询 IN(...)，比逐条 N 次往返便宜。
 */
export async function canonicalKeysByAliases(
  inputs: Array<{ source: ModelAliasSource; aliasValue: string }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (inputs.length === 0) return out;
  const seen = new Set<string>();
  const ors: Array<{ source: ModelAliasSource; aliasValue: string }> = [];
  for (const it of inputs) {
    const v = it.aliasValue.trim();
    if (!v) continue;
    const k = `${it.source}::${v}`;
    if (seen.has(k)) continue;
    seen.add(k);
    ors.push({ source: it.source, aliasValue: v });
  }
  if (ors.length === 0) return out;
  const rows = await prisma.modelAlias.findMany({
    where: { OR: ors, active: true, catalog: { active: true } },
    select: { source: true, aliasValue: true, catalog: { select: { canonicalKey: true } } },
  });
  for (const r of rows) {
    if (r.catalog?.canonicalKey) {
      out.set(`${r.source}::${r.aliasValue}`, r.catalog.canonicalKey);
    }
  }
  return out;
}
