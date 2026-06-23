import { NextResponse, type NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  DashboardScopeError,
  parseDashboardQueryFromSearchParams,
} from "@/lib/gateway/log-dashboard-query";
import {
  awaitOpportunisticGatewayPoll,
  parseGatewayLogPollParams,
  scheduleOpportunisticGatewayPoll,
} from "@/lib/gateway/log-read-poll-guard";
import {
  releasePollPoolCanvasTask,
  releasePollPoolGatewayLog,
} from "@/lib/gateway/poll-pool-release";
import { fetchPollPoolSnapshot } from "@/lib/gateway/poll-pool-snapshot";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import {
  readGenerationSlowWarnConfig,
  updateGenerationSlowWarnSec,
} from "@/lib/generation/slow-warn-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requirePollPoolAdmin(
  request: NextRequest,
): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof requireGatewaySessionUser>>> }
  | { ok: false; response: NextResponse }
> {
  const user = await requireGatewaySessionUser(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  if (!user.bookUserId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "未关联 Book 账号" }, { status: 403 }),
    };
  }
  const bookUser = await prisma.user.findUnique({
    where: { id: user.bookUserId },
    select: { role: true },
  });
  if (!canViewFinanceCost(bookUser?.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "仅平台管理员可修改预警阈值" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

/** 轮询池快照：Gateway RUNNING 队列 + Canvas/Story 待 poll 任务。 */
export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const pollOpts = parseGatewayLogPollParams(request.nextUrl.searchParams);
  const query = parseDashboardQueryFromSearchParams(request.nextUrl.searchParams);
  // 轮询池只看在飞任务，去掉 hours/from 时间窗（避免多余 submittedAt 扫描）
  query.filters.submittedFrom = undefined;
  query.filters.submittedTo = undefined;

  try {
    const snapshot = await fetchPollPoolSnapshot({
      gatewaySessionUser: {
        id: user.id,
        bookUserId: user.bookUserId,
        email: user.email,
      },
      query,
    });

    const hasSlow =
      snapshot.gateway.slowCount > 0 ||
      snapshot.canvas.slowCount > 0 ||
      snapshot.story.slowCount > 0;

    let pollResult: Awaited<
      ReturnType<typeof awaitOpportunisticGatewayPoll>
    > = { ran: false };

    if (pollOpts.skip) {
      // 只读快照
    } else if (pollOpts.force) {
      // 用户点「立即 poll」：等待结果
      pollResult = await awaitOpportunisticGatewayPoll(user.id, {
        force: true,
      });
    } else if (hasSlow) {
      // 有预警任务：后台单飞 poll，不阻塞 HTTP（避免打开/刷新轮询池卡数分钟）
      const scheduled = scheduleOpportunisticGatewayPoll(user.id, {
        force: true,
      });
      pollResult = { ran: scheduled.scheduled };
    }

    return NextResponse.json({
      ...snapshot,
      poll: {
        gatewayRan: pollResult.ran,
        autoHandler: pollResult.autoHandler ?? null,
      },
    });
  } catch (e) {
    if (e instanceof DashboardScopeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

/** 更新全站预警阈值（秒） */
export async function PATCH(request: NextRequest) {
  const auth = await requirePollPoolAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    slowWarnSec?: number;
  } | null;
  const sec = Number(body?.slowWarnSec);
  if (!Number.isFinite(sec) || sec < 60 || sec > 7200) {
    return NextResponse.json(
      { error: "slowWarnSec 须在 60～7200 之间" },
      { status: 400 },
    );
  }

  const saved = await updateGenerationSlowWarnSec(sec);
  const cfg = await readGenerationSlowWarnConfig();
  return NextResponse.json({
    ok: true,
    slowWarnSec: saved,
    slowWarnMs: saved * 1000,
    source: cfg.source,
  });
}

/** 手动恢复 / 释放卡住的任务 */
export async function POST(request: NextRequest) {
  const auth = await requirePollPoolAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    target?: "gateway" | "canvas";
    id?: string;
    action?: "recover" | "fail";
  } | null;

  const target = body?.target;
  const id = body?.id?.trim();
  const action = body?.action;
  if (!target || !id || (action !== "recover" && action !== "fail")) {
    return NextResponse.json(
      { error: "需要 target / id / action(recover|fail)" },
      { status: 400 },
    );
  }

  const result =
    target === "gateway"
      ? await releasePollPoolGatewayLog(id, action)
      : await releasePollPoolCanvasTask(id, action);

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
