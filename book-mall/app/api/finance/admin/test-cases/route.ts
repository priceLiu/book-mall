import { NextRequest } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import {
  buildFinanceTestCatalogPayload,
  FINANCE_VITEST_CATALOG,
  type FinanceTestCase,
} from "@/lib/finance/finance-test-catalog";
import { buildFinanceBusinessScenarios } from "@/lib/finance/finance-business-scenarios";

const execFileAsync = promisify(execFile);

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

type VitestAssertion = { fullName: string; status: string; title: string };

async function runVitestAndMatch(): Promise<{
  ok: boolean;
  numPassed: number;
  numFailed: number;
  numTotal: number;
  results: Record<string, "passed" | "failed" | "skipped">;
  error?: string;
}> {
  const bookRoot = path.resolve(process.cwd());
  try {
    const { stdout } = await execFileAsync(
      "pnpm",
      ["exec", "vitest", "run", "--reporter=json"],
      { cwd: bookRoot, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const lastLine = stdout.trim().split("\n").filter(Boolean).pop() ?? "{}";
    const json = JSON.parse(lastLine) as {
      numPassedTests?: number;
      numFailedTests?: number;
      numTotalTests?: number;
      success?: boolean;
      testResults?: { assertionResults?: VitestAssertion[] }[];
    };
    const results: Record<string, "passed" | "failed" | "skipped"> = {};
    for (const file of json.testResults ?? []) {
      for (const a of file.assertionResults ?? []) {
        results[a.fullName] = a.status as "passed" | "failed" | "skipped";
      }
    }
    return {
      ok: json.success === true,
      numPassed: json.numPassedTests ?? 0,
      numFailed: json.numFailedTests ?? 0,
      numTotal: json.numTotalTests ?? 0,
      results,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      numPassed: 0,
      numFailed: 0,
      numTotal: 0,
      results: {},
      error: msg.slice(0, 500),
    };
  }
}

function attachStatus(
  cases: FinanceTestCase[],
  results: Record<string, "passed" | "failed" | "skipped">,
) {
  return cases.map((c) => ({
    ...c,
    status: results[c.fullName] ?? ("unknown" as const),
  }));
}

/** 财务 2.0 业务测算 + 技术验收目录；?run=1 时执行 vitest 并附带通过/失败状态。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "财务测算仅财务管理员可见");
  }

  const business = buildFinanceBusinessScenarios();
  const payload = buildFinanceTestCatalogPayload();
  const shouldRun = request.nextUrl.searchParams.get("run") === "1";

  if (!shouldRun) {
    return financeJson(request, { business, ...payload, lastRun: null });
  }

  const run = await runVitestAndMatch();
  return financeJson(request, {
    business,
    ...payload,
    allVitest: attachStatus(FINANCE_VITEST_CATALOG, run.results),
    byCategory: payload.byCategory.map((g) => ({
      ...g,
      cases: attachStatus(g.cases, run.results),
    })),
    lastRun: {
      at: new Date().toISOString(),
      ...run,
    },
  });
}
