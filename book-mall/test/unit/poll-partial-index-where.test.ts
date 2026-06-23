import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GENERATION_INFLIGHT_STATUSES } from "@/lib/generation/traffic-control/constants";

/**
 * Gen-HotCold-R2 Phase 0 回归守卫：
 * 部分索引（partial index）的 WHERE 状态集合必须与 poll/dispatch 实际查询用的
 * GENERATION_INFLIGHT_STATUSES 完全一致，否则索引无法命中、退回全表扫描。
 */
const MIGRATION_SQL = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260716130000_genhotcold_partial_indexes/migration.sql",
  ),
  "utf8",
);

function parseInStatusSet(indexName: string): string[] {
  // 匹配：CREATE INDEX ... "<indexName>" ... WHERE "status" IN ('A', 'B', ...)
  const re = new RegExp(
    `"${indexName}"[\\s\\S]*?WHERE\\s+"status"\\s+IN\\s*\\(([^)]*)\\)`,
    "i",
  );
  const m = MIGRATION_SQL.match(re);
  if (!m) throw new Error(`未在 migration.sql 找到索引 ${indexName} 的 WHERE IN 子句`);
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
}

describe("genhotcold partial index WHERE clauses", () => {
  it("canvas 在飞索引状态集合 == GENERATION_INFLIGHT_STATUSES", () => {
    const got = parseInStatusSet("CanvasGenerationTask_inflight_queuedAt_idx");
    expect(new Set(got)).toEqual(new Set(GENERATION_INFLIGHT_STATUSES));
  });

  it("story 在飞索引状态集合 == GENERATION_INFLIGHT_STATUSES", () => {
    const got = parseInStatusSet("StoryGenerationTask_inflight_queuedAt_idx");
    expect(new Set(got)).toEqual(new Set(GENERATION_INFLIGHT_STATUSES));
  });

  it("SUBMITTED 轮询索引存在且仅针对 SUBMITTED", () => {
    expect(MIGRATION_SQL).toMatch(
      /"CanvasGenerationTask_submitted_lastPolledAt_idx"[\s\S]*?WHERE\s+"status"\s*=\s*'SUBMITTED'/i,
    );
    expect(MIGRATION_SQL).toMatch(
      /"StoryGenerationTask_submitted_lastPolledAt_idx"[\s\S]*?WHERE\s+"status"\s*=\s*'SUBMITTED'/i,
    );
  });

  it("GatewayRequestLog RUNNING 在飞日志索引存在", () => {
    expect(MIGRATION_SQL).toMatch(
      /"GatewayRequestLog_running_submittedAt_idx"[\s\S]*?WHERE\s+"status"\s*=\s*'RUNNING'\s+AND\s+"externalTaskId"\s+IS\s+NOT\s+NULL/i,
    );
  });
});
