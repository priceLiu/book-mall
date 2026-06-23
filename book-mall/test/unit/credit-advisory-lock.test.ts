import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { transactionMock, ledgerFindUniqueMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  ledgerFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creditLedger: { findUnique: ledgerFindUniqueMock },
    $transaction: transactionMock,
  },
}));

// 让事务直接执行回调（不做真重试），便于断言锁 SQL。
vi.mock("@/lib/db-tx-retry", () => ({
  runTxWithRetry: (fn: () => unknown) => fn(),
  BILLING_DB_TX_OPTIONS: {},
}));

import { reserveCredits } from "@/lib/billing/credit-account-service";

type ExecCall = { sql: string; values: unknown[] };

function makeTx(execCalls: ExecCall[]) {
  return {
    $executeRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      execCalls.push({ sql: strings.join("?"), values });
      return Promise.resolve(1);
    }),
    creditAccount: {
      upsert: vi.fn(async () => ({
        id: "acc-1",
        balanceCredits: 1000,
        reservedCredits: 0,
        videoBalanceCredits: 0,
        videoReservedCredits: 0,
      })),
      update: vi.fn(async () => ({
        id: "acc-1",
        balanceCredits: 900,
        reservedCredits: 100,
      })),
    },
    creditLedger: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "ledger-1",
        balanceAfter: 900,
        ...data,
      })),
    },
  };
}

/** 与实现同款派生，用于断言锁键正确。 */
function expectedKeys(ownerType: string, ownerId: string): [number, number] {
  const buf = createHash("sha256")
    .update(`credit-account:${ownerType}:${ownerId}`)
    .digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

async function runReserveFor(ownerId: string): Promise<ExecCall[]> {
  const execCalls: ExecCall[] = [];
  transactionMock.mockImplementationOnce(
    async (fn: (tx: unknown) => unknown) => fn(makeTx(execCalls)),
  );
  await reserveCredits({
    ref: { ownerType: "USER", ownerId },
    credits: 100,
    pool: "GENERAL",
  });
  return execCalls;
}

describe("writeLedger 按账户 advisory 串行写", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    ledgerFindUniqueMock.mockReset();
    ledgerFindUniqueMock.mockResolvedValue(null);
  });

  it("事务内首条语句即获取 pg_advisory_xact_lock，键与账户派生一致", async () => {
    const calls = await runReserveFor("user-A");
    expect(calls.length).toBeGreaterThan(0);
    const lockCall = calls[0]!;
    expect(lockCall.sql).toContain("pg_advisory_xact_lock");
    expect(lockCall.values).toEqual(expectedKeys("USER", "user-A"));
  });

  it("不同账户 → 不同锁键（互不阻塞）", async () => {
    const a = await runReserveFor("user-A");
    const b = await runReserveFor("user-B");
    expect(a[0]!.values).not.toEqual(b[0]!.values);
  });

  it("同账户 → 相同锁键（串行排队）", async () => {
    const a1 = await runReserveFor("user-A");
    const a2 = await runReserveFor("user-A");
    expect(a1[0]!.values).toEqual(a2[0]!.values);
  });
});
