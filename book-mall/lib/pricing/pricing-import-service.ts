import type { Prisma, PrismaClient, PricingBillingKind } from "@prisma/client";
import type { PricingDraftLine } from "./price-md-china-types";
import {
  draftToSnapshot,
  pricingLineFingerprint,
  snapshotsEqual,
  type LineSnapshot,
} from "./pricing-fingerprint";

function indexByFingerprint(lines: LineSnapshot[]): Map<string, LineSnapshot> {
  const m = new Map<string, LineSnapshot>();
  for (const L of lines) {
    const fp = pricingLineFingerprint(L.billingKind, L.modelKey, L.tierRaw);
    m.set(fp, L);
  }
  return m;
}

async function writeChangeEvents(
  tx: Prisma.TransactionClient,
  fromFp: Map<string, LineSnapshot>,
  toFp: Map<string, LineSnapshot>,
  fromVersionId: string | null,
  toVersionId: string,
) {
  const keys = new Set<string>();
  for (const k of fromFp.keys()) keys.add(k);
  for (const k of toFp.keys()) keys.add(k);

  const events: Prisma.PricingLineChangeEventCreateManyInput[] = [];
  for (const fp of keys) {
    const oldS = fromFp.get(fp);
    const newS = toFp.get(fp);
    if (oldS && newS) {
      if (!snapshotsEqual(oldS, newS)) {
        events.push({
          fromVersionId,
          toVersionId,
          modelKey: newS.modelKey,
          tierRaw: newS.tierRaw,
          billingKind: newS.billingKind,
          changeType: "CHANGED",
          oldSnapshot: oldS as object,
          newSnapshot: newS as object,
        });
      }
      continue;
    }
    if (!oldS && newS) {
      events.push({
        fromVersionId,
        toVersionId,
        modelKey: newS.modelKey,
        tierRaw: newS.tierRaw,
        billingKind: newS.billingKind,
        changeType: "ADDED",
        oldSnapshot: undefined,
        newSnapshot: newS as object,
      });
    } else if (oldS && !newS) {
      events.push({
        fromVersionId,
        toVersionId,
        modelKey: oldS.modelKey,
        tierRaw: oldS.tierRaw,
        billingKind: oldS.billingKind,
        changeType: "REMOVED",
        oldSnapshot: oldS as object,
        newSnapshot: undefined,
      });
    }
  }

  const CHUNK = 500;
  for (let i = 0; i < events.length; i += CHUNK) {
    await tx.pricingLineChangeEvent.createMany({ data: events.slice(i, i + CHUNK) });
  }
}

export type CreatePricingVersionInput = {
  kind: string;
  sourceSha256: string;
  label?: string | null;
  importedByUserId?: string | null;
  parseWarnings?: unknown[] | null;
  lines: PricingDraftLine[];
};

/** 同一版本内 fingerprint 唯一：重复行仅保留首次出现（避免 doc 多段「中国内地」等同表重复插入）。 */
function dedupeDraftLinesByFingerprint(lines: PricingDraftLine[]): PricingDraftLine[] {
  const seen = new Set<string>();
  const out: PricingDraftLine[] = [];
  for (const L of lines) {
    const fp = pricingLineFingerprint(L.billingKind, L.modelKey, L.tierRaw);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(L);
  }
  return out;
}

/**
 * 插入新价目版本并设为 current；与上一 current 做 diff 写入 {@link PricingLineChangeEvent}。
 */
export async function createPricingVersionAndSetCurrent(
  prisma: PrismaClient,
  input: CreatePricingVersionInput,
): Promise<{ versionId: string }> {
  const prev = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    include: { lines: true },
  });

  const linesIn = dedupeDraftLinesByFingerprint(input.lines);
  const snapshotsNew = linesIn.map((L) => draftToSnapshot(L));
  const toFp = indexByFingerprint(snapshotsNew);

  const fromFp =
    prev == null
      ? new Map<string, LineSnapshot>()
      : indexByFingerprint(
          prev.lines.map((r) =>
            draftToSnapshot({
              modelKey: r.modelKey,
              tierRaw: r.tierRaw,
              billingKind: r.billingKind,
              inputYuanPerMillion: r.inputYuanPerMillion,
              outputYuanPerMillion: r.outputYuanPerMillion,
              costJson: r.costJson,
            }),
          ),
        );

  return prisma.$transaction(
    async (tx) => {
    if (prev) {
      await tx.pricingSourceVersion.update({
        where: { id: prev.id },
        data: { isCurrent: false },
      });
    }

    const ver = await tx.pricingSourceVersion.create({
      data: {
        kind: input.kind,
        sourceSha256: input.sourceSha256,
        label: input.label ?? null,
        importedByUserId: input.importedByUserId ?? null,
        parseWarnings: (input.parseWarnings as Prisma.InputJsonValue | undefined) ?? undefined,
        rowCount: linesIn.length,
        isCurrent: true,
      },
    });

    await tx.pricingSourceLine.createMany({
      data: linesIn.map((L) => ({
        versionId: ver.id,
        sectionH2: L.sectionH2,
        sectionH3: L.sectionH3,
        modelKey: L.modelKey,
        modelLabelRaw: L.modelLabelRaw,
        tierRaw: L.tierRaw,
        billingKind: L.billingKind,
        inputYuanPerMillion: L.inputYuanPerMillion,
        outputYuanPerMillion: L.outputYuanPerMillion,
        costJson: L.costJson === null ? undefined : (L.costJson as object),
        fingerprint: pricingLineFingerprint(L.billingKind, L.modelKey, L.tierRaw),
        sourceLine: L.sourceLine,
      })),
    });

    await writeChangeEvents(tx, fromFp, toFp, prev?.id ?? null, ver.id);

    return { versionId: ver.id };
  },
    { maxWait: 20_000, timeout: 300_000 },
  );
}

/** 自 price.md 解析行 + 保留上一版本中「非 TOKEN_IN_OUT」行，生成新草稿。 */
export function mergeMarkdownTokenImport(
  tokenDraftLines: PricingDraftLine[],
  preserveNonTokenFromPrevious: PricingDraftLine[],
): PricingDraftLine[] {
  const kept = preserveNonTokenFromPrevious.filter((l) => l.billingKind !== "TOKEN_IN_OUT");
  return [...tokenDraftLines, ...kept];
}

/** 上传 CSV 与当前行按 fingerprint 合并：CSV 覆盖同 fingerprint，其余行保留。 */
export function mergeCsvImportIntoCurrent(
  previous: PricingDraftLine[],
  csvRows: PricingDraftLine[],
): PricingDraftLine[] {
  const fps = new Set(
    csvRows.map((r) => pricingLineFingerprint(r.billingKind, r.modelKey, r.tierRaw)),
  );
  const kept = previous.filter(
    (p) => !fps.has(pricingLineFingerprint(p.billingKind, p.modelKey, p.tierRaw)),
  );
  return [...csvRows, ...kept];
}

export async function loadCurrentPricingDrafts(prisma: PrismaClient): Promise<PricingDraftLine[]> {
  const v = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    include: { lines: true },
  });
  if (!v) return [];
  return v.lines.map((r) => ({
    sectionH2: r.sectionH2,
    sectionH3: r.sectionH3,
    modelKey: r.modelKey,
    modelLabelRaw: r.modelLabelRaw,
    tierRaw: r.tierRaw,
    billingKind: r.billingKind,
    inputYuanPerMillion: r.inputYuanPerMillion,
    outputYuanPerMillion: r.outputYuanPerMillion,
    costJson: r.costJson,
    sourceLine: r.sourceLine,
  }));
}

export function tokenRowsToDraftRows(
  rows: import("./price-md-china-types").PriceMdChinaTokenRow[],
): PricingDraftLine[] {
  return rows.map((r) => {
    const modelKey =
      r.modelKeys[0] ??
      r.modelRaw.split(">")[0]?.trim().replace(/\s+/g, "").toLowerCase() ??
      "unknown";
    return {
      sectionH2: r.sectionH2,
      sectionH3: r.sectionH3,
      modelKey,
      modelLabelRaw: r.modelRaw,
      tierRaw: r.tierRaw,
      billingKind: "TOKEN_IN_OUT" as PricingBillingKind,
      inputYuanPerMillion: r.inputYuanPerMillion,
      outputYuanPerMillion: r.outputYuanPerMillion,
      costJson: null,
      sourceLine: r.sourceLine,
    };
  });
}
