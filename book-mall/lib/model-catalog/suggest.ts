import type { Prisma } from "@prisma/client";
import { AliasConfidence, ModelAliasSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * v003 自动校准：候选别名 → 推荐 canonical（HIGH/MEDIUM/LOW）。
 *
 * 算法（三级，便宜→贵）：
 *   1) exact     —— alias 与 ModelCatalog.canonicalKey 或某条 ModelAlias.aliasValue 完全相同 → HIGH
 *   2) prefix    —— alias 以 canonicalKey 开头或 canonicalKey 以 alias 开头（如 `sfm_inferenceHH_public_cn` 与 `happyhorse-*`） → MEDIUM
 *   3) fuzzy     —— Levenshtein 距离 ≤ 2 或 token-Jaccard ≥ 0.7 → LOW
 *   未命中：suggest=null，前端展示在"未归类"区
 */

export type CandidateAlias = {
  source: ModelAliasSource;
  aliasValue: string;
  tierRawHint?: string | null;
  /** Prisma 不允许把 nullable JSON 字段写 null（要写"清空"得用 Prisma.NullableJsonNullValueInput）；这里只接 undefined */
  evidence?: Prisma.InputJsonValue;
};

export type SuggestResult = {
  candidate: CandidateAlias;
  suggested: {
    catalogId: string;
    canonicalKey: string;
    confidence: AliasConfidence;
    matchedBy: "exact" | "prefix" | "fuzzy";
  } | null;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = dp[j]!;
      dp[j] = Math.min(
        dp[j]! + 1,
        dp[j - 1]! + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = t;
    }
  }
  return dp[b.length]!;
}

function jaccard(a: string, b: string): number {
  const sa = new Set(a.split(/[-._\s]+/).filter(Boolean));
  const sb = new Set(b.split(/[-._\s]+/).filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return inter / union;
}

/** 一次性查所有 catalog + 已有 alias，构建匹配池（O(N) 一次往返）。 */
async function loadMatchingPool() {
  const catalogs = await prisma.modelCatalog.findMany({
    where: { active: true },
    select: { id: true, canonicalKey: true },
  });
  const aliases = await prisma.modelAlias.findMany({
    where: { active: true, catalogId: { not: null } },
    select: { aliasValue: true, catalogId: true },
  });
  const byCanonical = new Map<string, { id: string; canonicalKey: string }>();
  for (const c of catalogs) byCanonical.set(normalize(c.canonicalKey), c);
  const byAlias = new Map<string, string>();
  for (const a of aliases) {
    if (a.catalogId) byAlias.set(normalize(a.aliasValue), a.catalogId);
  }
  return { catalogs, byCanonical, byAlias };
}

export async function suggestAliasMatches(
  candidates: CandidateAlias[],
): Promise<SuggestResult[]> {
  if (candidates.length === 0) return [];
  const { catalogs, byCanonical, byAlias } = await loadMatchingPool();
  const catalogNorm = catalogs.map((c) => ({
    ...c,
    norm: normalize(c.canonicalKey),
  }));

  return candidates.map((cand) => {
    const v = normalize(cand.aliasValue);

    // 1) exact: 与某 canonicalKey 完全相同
    const ec = byCanonical.get(v);
    if (ec) {
      return {
        candidate: cand,
        suggested: {
          catalogId: ec.id,
          canonicalKey: ec.canonicalKey,
          confidence: AliasConfidence.HIGH,
          matchedBy: "exact",
        },
      } as const;
    }
    // 1b) exact: 与已存 alias 完全相同
    const eaId = byAlias.get(v);
    if (eaId) {
      const c = catalogs.find((x) => x.id === eaId);
      if (c) {
        return {
          candidate: cand,
          suggested: {
            catalogId: c.id,
            canonicalKey: c.canonicalKey,
            confidence: AliasConfidence.HIGH,
            matchedBy: "exact",
          },
        } as const;
      }
    }

    // 2) prefix: 双向前缀（5 字符以上才算）
    let best: {
      id: string;
      canonicalKey: string;
      score: number;
      matchedBy: "prefix" | "fuzzy";
    } | null = null;
    for (const c of catalogNorm) {
      if (c.norm.length < 5 || v.length < 5) continue;
      if (v.startsWith(c.norm) || c.norm.startsWith(v)) {
        const sc = Math.min(c.norm.length, v.length);
        if (!best || sc > best.score) {
          best = { id: c.id, canonicalKey: c.canonicalKey, score: sc, matchedBy: "prefix" };
        }
      }
    }
    if (best) {
      return {
        candidate: cand,
        suggested: {
          catalogId: best.id,
          canonicalKey: best.canonicalKey,
          confidence: AliasConfidence.MEDIUM,
          matchedBy: best.matchedBy,
        },
      } as const;
    }

    // 3) fuzzy: Levenshtein ≤ 2 或 jaccard ≥ 0.7
    let fuzzyBest: { id: string; canonicalKey: string; score: number } | null = null;
    for (const c of catalogNorm) {
      const lev = levenshtein(v, c.norm);
      const jac = jaccard(v, c.norm);
      if (lev <= 2 || jac >= 0.7) {
        const score = jac * 100 + (lev <= 2 ? 50 - lev : 0);
        if (!fuzzyBest || score > fuzzyBest.score) {
          fuzzyBest = { id: c.id, canonicalKey: c.canonicalKey, score };
        }
      }
    }
    if (fuzzyBest) {
      return {
        candidate: cand,
        suggested: {
          catalogId: fuzzyBest.id,
          canonicalKey: fuzzyBest.canonicalKey,
          confidence: AliasConfidence.LOW,
          matchedBy: "fuzzy",
        },
      } as const;
    }

    return { candidate: cand, suggested: null };
  });
}

/**
 * 把候选别名集合 upsert 进 ModelAlias 表：
 *  - 已有 (source, aliasValue) → 仅更新 evidence/updatedAt，不重写已挂的 catalogId
 *  - 新行：附带 suggest 结果（catalogId/confidence/matchedBy）
 *
 * 返回受影响行（含 suggestion 与是否新建），便于审计与 UI 显示。
 */
export async function ingestCandidateAliases(candidates: CandidateAlias[]): Promise<{
  created: number;
  updated: number;
  matched: number;
  pending: number;
}> {
  if (candidates.length === 0) {
    return { created: 0, updated: 0, matched: 0, pending: 0 };
  }
  const suggestions = await suggestAliasMatches(candidates);
  let created = 0;
  let updated = 0;
  let matched = 0;
  let pending = 0;

  for (const s of suggestions) {
    const existing = await prisma.modelAlias.findUnique({
      where: {
        source_aliasValue: {
          source: s.candidate.source,
          aliasValue: s.candidate.aliasValue,
        },
      },
      select: { id: true, catalogId: true },
    });
    if (existing) {
      const updateData: Prisma.ModelAliasUpdateInput = {};
      if (s.candidate.evidence !== undefined) {
        updateData.evidence = s.candidate.evidence;
      }
      if (s.candidate.tierRawHint !== undefined) {
        updateData.tierRawHint = s.candidate.tierRawHint;
      }
      await prisma.modelAlias.update({
        where: { id: existing.id },
        data: updateData,
      });
      updated++;
      if (existing.catalogId) matched++;
      else pending++;
      continue;
    }
    const createData: Prisma.ModelAliasUncheckedCreateInput = {
      source: s.candidate.source,
      aliasValue: s.candidate.aliasValue,
      tierRawHint: s.candidate.tierRawHint ?? null,
      catalogId: s.suggested?.catalogId ?? null,
      confidence: s.suggested?.confidence ?? AliasConfidence.LOW,
      matchedBy: s.suggested?.matchedBy ?? null,
    };
    if (s.candidate.evidence !== undefined) {
      createData.evidence = s.candidate.evidence;
    }
    await prisma.modelAlias.create({ data: createData });
    created++;
    if (s.suggested) matched++;
    else pending++;
  }
  return { created, updated, matched, pending };
}
