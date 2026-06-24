import { describe, expect, it } from "vitest";
import {
  getGenerationPollBatch,
  getGenerationPollConcurrency,
  getEffectiveGenerationPollConcurrency,
  getGenerationPollShardCount,
} from "@/lib/generation/poll-config";
import {
  hashPollShardKey,
  selectPollShardTasks,
  taskBelongsToPollShard,
} from "@/lib/generation/poll-shard";
import { resolveTeamConcurrencyCap } from "@/lib/tenant/team-concurrency";

describe("generation poll scale defaults", () => {
  it("默认 batch 100、并发 25", () => {
    expect(getGenerationPollBatch()).toBe(100);
    expect(getGenerationPollConcurrency()).toBe(25);
    expect(getGenerationPollShardCount()).toBe(1);
  });

  it("effective 并发：poll-loop 进程按 connection_limit 封顶", () => {
    const prevLimit = process.env.PRISMA_CONNECTION_LIMIT;
    const prevWorker = process.env.GENERATION_POLL_WORKER;
    process.env.PRISMA_CONNECTION_LIMIT = "1";
    process.env.GENERATION_POLL_WORKER = "1";
    expect(getEffectiveGenerationPollConcurrency()).toBe(1);
    process.env.PRISMA_CONNECTION_LIMIT = "20";
    expect(getEffectiveGenerationPollConcurrency()).toBe(
      Math.min(25, 20 - 3),
    );
    if (prevLimit === undefined) delete process.env.PRISMA_CONNECTION_LIMIT;
    else process.env.PRISMA_CONNECTION_LIMIT = prevLimit;
    if (prevWorker === undefined) delete process.env.GENERATION_POLL_WORKER;
    else process.env.GENERATION_POLL_WORKER = prevWorker;
  });

  it("web 进程 opportunistic poll 最多 2 路并行", () => {
    const prevLimit = process.env.PRISMA_CONNECTION_LIMIT;
    const prevWorker = process.env.GENERATION_POLL_WORKER;
    delete process.env.GENERATION_POLL_WORKER;
    process.env.PRISMA_CONNECTION_LIMIT = "30";
    expect(getEffectiveGenerationPollConcurrency()).toBe(2);
    if (prevLimit === undefined) delete process.env.PRISMA_CONNECTION_LIMIT;
    else process.env.PRISMA_CONNECTION_LIMIT = prevLimit;
    if (prevWorker === undefined) delete process.env.GENERATION_POLL_WORKER;
    else process.env.GENERATION_POLL_WORKER = prevWorker;
  });
});

describe("poll shard", () => {
  it("hash 分片稳定", () => {
    const a = hashPollShardKey("cm123");
    const b = hashPollShardKey("cm123");
    expect(a).toBe(b);
  });

  it("selectPollShardTasks 限制条数", () => {
    const prevCount = process.env.GENERATION_POLL_SHARD_COUNT;
    const prevIndex = process.env.GENERATION_POLL_SHARD_INDEX;
    process.env.GENERATION_POLL_SHARD_COUNT = "2";
    process.env.GENERATION_POLL_SHARD_INDEX = "0";

    const items = Array.from({ length: 20 }, (_, i) => ({ id: `task-${i}` }));
    const picked = selectPollShardTasks(items, 3);
    expect(picked.length).toBeLessThanOrEqual(3);
    for (const t of picked) {
      expect(taskBelongsToPollShard(t.id)).toBe(true);
    }

    if (prevCount === undefined) delete process.env.GENERATION_POLL_SHARD_COUNT;
    else process.env.GENERATION_POLL_SHARD_COUNT = prevCount;
    if (prevIndex === undefined) delete process.env.GENERATION_POLL_SHARD_INDEX;
    else process.env.GENERATION_POLL_SHARD_INDEX = prevIndex;
  });
});

describe("team concurrency cap override", () => {
  it("TEAM_MAX_CONCURRENCY_CAP 可突破至尊 35", () => {
    const prev = process.env.TEAM_MAX_CONCURRENCY_CAP;
    process.env.TEAM_MAX_CONCURRENCY_CAP = "150";
    expect(resolveTeamConcurrencyCap("至尊版")).toBe(150);
    if (prev === undefined) delete process.env.TEAM_MAX_CONCURRENCY_CAP;
    else process.env.TEAM_MAX_CONCURRENCY_CAP = prev;
  });
});
