import {
  getPrismaConnectionLimit,
  datasourceUsesPgbouncerFromEnv,
} from "@/lib/prisma-pool-config";

/** dev:all 固定 3 个 poll-loop 子进程（story / canvas / gateway） */
export const DEV_POLL_WORKER_COUNT = 3;

/** poll-loop package.json 内 PRISMA_CONNECTION_LIMIT（须与 package.json 一致） */
export const DEV_POLL_WORKER_CONNECTION_LIMIT = 1;

export type DevConnectionBudget = {
  mallLimit: number;
  pollWorkerLimit: number;
  pollWorkerCount: number;
  estimatedTotal: number;
  recommendedMax: number;
  usesPgbouncer: boolean;
  overBudget: boolean;
  hints: string[];
};

function readPollLimitFromEnv(): number {
  const fromEnv = Number(process.env.PRISMA_POLL_CONNECTION_LIMIT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.round(fromEnv);
  }
  return DEV_POLL_WORKER_CONNECTION_LIMIT;
}

export function getDevConnectionBudget(): DevConnectionBudget {
  const mallLimit = getPrismaConnectionLimit();
  const pollWorkerLimit = readPollLimitFromEnv();
  const pollWorkerCount = DEV_POLL_WORKER_COUNT;
  const estimatedTotal = mallLimit + pollWorkerLimit * pollWorkerCount;
  const usesPgbouncer = datasourceUsesPgbouncerFromEnv();
  const recommendedMax = usesPgbouncer ? 45 : 80;

  const hints: string[] = [];
  if (estimatedTotal > recommendedMax) {
    hints.push(
      `dev:all 估算占用 ${estimatedTotal} 连接（mall ${mallLimit} + poll ${pollWorkerCount}×${pollWorkerLimit}），建议 ≤ ${recommendedMax}。可试 pnpm dev:all:nopoll 或调低 DATABASE_URL connection_limit。`,
    );
  }
  if (mallLimit <= 10) {
    hints.push(
      "book-mall 进程 connection_limit 偏小（≤10），易 P2024；直连 CDB 建议 30，PgBouncer 建议 15。",
    );
  }

  return {
    mallLimit,
    pollWorkerLimit,
    pollWorkerCount,
    estimatedTotal,
    recommendedMax,
    usesPgbouncer,
    overBudget: estimatedTotal > recommendedMax,
    hints,
  };
}
