/**
 * 画布 · 图生视频（i2v）并发压测 —— 仅 /dev 测试，禁止生产使用。
 *
 * 目标（画布功能上线前必测）：
 *   1. 同时发起 N 条图生视频任务能否正常运行；
 *   2. 是否按交通控流限流（runningVideoCount 不超过 maxConcurrency = 阻塞生效）；
 *   3. 阻塞的任务能否在前序完成、释放槽位后被正常出队（释放生效）；
 *   4. Gateway 火山视频日志的 4 个时间（总耗时 / 排队 / 厂商生成 / 轮询延迟）是否正确。
 *
 * 全程走真实管线：createStoryScopedCanvasTask(QUEUED) → dispatchQueuedCanvasTasks
 * （交通控流信号灯 + 令牌桶）→ Gateway 火山 createTask → runCanvasPollWorker 推进 +
 * Gateway recordInfo 轮询写时间拆分 → 终态释放槽位。模型固定 Seedance 2.0。
 */
import { prisma } from "@/lib/prisma";
import { createCanvasProjectForUser } from "@/lib/canvas/canvas-project-service";
import { createStoryScopedCanvasTask } from "@/lib/canvas/canvas-story-scope";
import { dispatchQueuedCanvasTasks } from "@/lib/generation/traffic-control/dispatch-canvas";
import { isTrafficControlEnabled } from "@/lib/generation/traffic-control/constants";
import { resolveCanvasProjectTrafficScope } from "@/lib/generation/traffic-control/scope-key";
import { resolveMaxConcurrencyForScope } from "@/lib/generation/traffic-control/scope-key";
import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";
import {
  GATEWAY_POLL_DELAY_LIMIT_MS,
  resolveVolcengineLogTiming,
} from "@/lib/gateway/log-volcengine-timing";
import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "@/lib/canvas/canvas-gateway-providers";
import type { Prisma } from "@prisma/client";

/** 火山官方 i2v 文档示例图（公网可达，方舟可拉取），作为首帧 */
export const DEFAULT_I2V_IMAGE_URL =
  "https://ark-project.tos-cn-beijing.volces.com/doc_image/i2v_foxrgirl.png";

export const I2V_LOAD_TEST_PROJECT_PREFIX = "[i2v并发压测]";
const TEST_PROMPT = "镜头缓慢推进，画面自然流畅，光影细腻。";

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);
const INFLIGHT_STATUSES = new Set(["QUEUED", "DISPATCHING", "PENDING", "SUBMITTED"]);

export type I2vTestUser = {
  userId: string;
  credentialId: string;
  credentialAlias: string;
  source: "explicit" | "auto";
};

/**
 * 解析一个可用于测试的用户：已在 Book 关联 sk-gw，且该 Key 绑定了 active 的 VOLCENGINE 凭证。
 * 传入 userId 时优先校验该用户；否则自动挑选第一个满足条件的用户。
 */
export async function resolveI2vTestUser(userId?: string): Promise<I2vTestUser> {
  const cred = await prisma.gatewayVendorCredential.findFirst({
    where: { providerKind: "VOLCENGINE", active: true },
    orderBy: [{ isDefaultForProvider: "desc" }, { createdAt: "desc" }],
    select: { id: true, alias: true },
  });
  if (!cred) {
    throw new Error("未找到 active 的 VOLCENGINE 凭证，请先在 Gateway 控制台配置火山方舟凭证");
  }

  if (userId?.trim()) {
    const u = await prisma.user.findUnique({
      where: { id: userId.trim() },
      select: { id: true, gatewayApiKeyId: true },
    });
    if (!u) throw new Error(`用户不存在：${userId}`);
    if (!u.gatewayApiKeyId) {
      throw new Error("该用户未关联 Gateway API Key（sk-gw）");
    }
    return {
      userId: u.id,
      credentialId: cred.id,
      credentialAlias: cred.alias,
      source: "explicit",
    };
  }

  // 自动挑选：找绑定该凭证、未吊销的 sk-gw，再找已关联该 Key 的 Book 用户
  const keys = await prisma.gatewayApiKey.findMany({
    where: { bindings: { some: { credentialId: cred.id } }, revokedAt: null },
    select: { id: true },
    take: 50,
  });
  for (const k of keys) {
    const linked = await prisma.user.findFirst({
      where: { gatewayApiKeyId: k.id },
      select: { id: true },
    });
    if (linked) {
      return {
        userId: linked.id,
        credentialId: cred.id,
        credentialAlias: cred.alias,
        source: "auto",
      };
    }
  }
  throw new Error("未找到已关联（绑定该 VOLCENGINE 凭证的 sk-gw）的 Book 用户");
}

export type StartI2vLoadTestArgs = {
  userId?: string;
  count?: number;
  durationSec?: number;
  resolution?: "720p" | "1080p";
  generateAudio?: boolean;
  aspectRatio?: string;
  imageUrl?: string;
  /** 固定 Seedance 2.0；保留参数仅为扩展 */
  modelKey?: string;
};

export type StartI2vLoadTestResult = {
  projectId: string;
  projectName: string;
  userId: string;
  credentialAlias: string;
  userSource: I2vTestUser["source"];
  count: number;
  durationSec: number;
  modelKey: string;
  imageUrl: string;
  trafficControlEnabled: boolean;
  maxConcurrency: number;
  scopeKey: string;
  taskIds: string[];
  dispatchResult: Awaited<ReturnType<typeof dispatchQueuedCanvasTasks>>;
};

export async function startI2vLoadTest(
  args: StartI2vLoadTestArgs = {},
): Promise<StartI2vLoadTestResult> {
  const count = clampInt(args.count ?? 10, 1, 30);
  const durationSec = clampInt(args.durationSec ?? 15, 4, 15);
  const resolution = args.resolution === "1080p" ? "1080p" : "720p";
  const generateAudio = args.generateAudio === true;
  const aspectRatio = args.aspectRatio?.trim() || "16:9";
  const imageUrl = args.imageUrl?.trim() || DEFAULT_I2V_IMAGE_URL;
  const modelKey = args.modelKey?.trim() || "doubao-seedance-2.0";

  const testUser = await resolveI2vTestUser(args.userId);

  const project = await createCanvasProjectForUser(testUser.userId, {
    name: `${I2V_LOAD_TEST_PROJECT_PREFIX} ${new Date()
      .toISOString()
      .replace("T", " ")
      .slice(0, 19)} · ${count}路`,
    description: "图生视频并发压测（/dev 工具自动创建，可安全删除）",
  });
  const projectId = project.id;

  const scope = await resolveCanvasProjectTrafficScope(projectId, testUser.userId);
  const maxConcurrency = await resolveMaxConcurrencyForScope(scope);
  const trafficControlEnabled = isTrafficControlEnabled();

  const taskIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const built = buildCanvasVideoVolcengineInput({
      modelKey,
      prompt: `${TEST_PROMPT}（#${i + 1}/${count}）`,
      imageUrl,
      options: { resolution, duration: durationSec, generateAudio, watermark: false },
      aspectRatio,
    });

    const inputPayload = {
      kind: "video-engine",
      prompt: `${TEST_PROMPT}（#${i + 1}/${count}）`,
      params: {
        resolution,
        duration: durationSec,
        generate_audio: generateAudio,
        aspect_ratio: aspectRatio,
      },
      providerId: GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
      modelKey,
      imageUrls: [imageUrl],
      mainFrameImageUrl: imageUrl,
      referenceImageUrls: [],
      providerKind: "VOLCENGINE",
      volcengineModel: built.model,
      volcengineBody: built.body,
      clientPage: `canvas/${projectId}/sbv1`,
      gatewayCredentialId: testUser.credentialId,
      i2vLoadTest: true,
    } as Prisma.InputJsonValue;

    const task = await createStoryScopedCanvasTask({
      projectId,
      nodeId: `i2v-load-test-${i + 1}`,
      actorUserId: testUser.userId,
      initialStatus: trafficControlEnabled ? "QUEUED" : "PENDING",
      data: {
        kind: "IMAGE",
        model: modelKey,
        providerId: null,
        inputHash: `i2v-load-test:${projectId}:${i + 1}`,
        inputPayload,
      },
    });
    taskIds.push(task.id);
  }

  const dispatchResult = await dispatchQueuedCanvasTasks({ projectId });

  return {
    projectId,
    projectName: project.name,
    userId: testUser.userId,
    credentialAlias: testUser.credentialAlias,
    userSource: testUser.source,
    count,
    durationSec,
    modelKey,
    imageUrl,
    trafficControlEnabled,
    maxConcurrency,
    scopeKey: scope.scopeKey,
    taskIds,
    dispatchResult,
  };
}

export type I2vTaskTiming = {
  durationMs: number | null;
  queueMs: number | null;
  generateMs: number | null;
  vendorPostProcessMs: number | null;
  pollDelayMs: number | null;
  pollDelayOverLimit: boolean;
  /** durationMs 与 (queue+generate+postProcess+poll) 的差（ms），用于一致性校验 */
  sumDeltaMs: number | null;
};

export type I2vTaskSnapshot = {
  id: string;
  nodeId: string;
  status: string;
  kieTaskId: string | null;
  gatewayLogId: string | null;
  gatewayStatus: string | null;
  failCode: string | null;
  failMessage: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  pollCount: number;
  ossUrl: string | null;
  timing: I2vTaskTiming;
};

export type I2vLoadTestStatus = {
  projectId: string;
  fetchedAt: string;
  trafficControlEnabled: boolean;
  maxConcurrency: number;
  scopeKey: string;
  runningVideoCount: number;
  dispatchTokens: number | null;
  counts: Record<string, number>;
  total: number;
  terminalCount: number;
  inflightCount: number;
  tasks: I2vTaskSnapshot[];
  verdicts: I2vVerdicts;
};

export type Verdict = "pass" | "fail" | "pending";
export type I2vVerdicts = {
  /** Q1 正常运行 */
  run: { verdict: Verdict; detail: string };
  /** Q2 阻塞（限流生效，无超额并发） */
  blocking: { verdict: Verdict; detail: string };
  /** Q3 阻塞释放（队列排空、槽位归零） */
  release: { verdict: Verdict; detail: string };
  /** Q4 四个时间正确 */
  timing: { verdict: Verdict; detail: string };
};

function readPayload(p: unknown): Record<string, unknown> {
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  return p as Record<string, unknown>;
}

export async function getI2vLoadTestStatus(
  projectId: string,
): Promise<I2vLoadTestStatus> {
  const project = await prisma.canvasProject.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true },
  });
  if (!project) throw new Error(`项目不存在：${projectId}`);

  const tasks = await prisma.canvasGenerationTask.findMany({
    where: { projectId },
    orderBy: { nodeId: "asc" },
    select: {
      id: true,
      nodeId: true,
      status: true,
      kieTaskId: true,
      inputPayload: true,
      failCode: true,
      failMessage: true,
      submittedAt: true,
      completedAt: true,
      pollCount: true,
      ossUrl: true,
    },
  });

  const scope = await resolveCanvasProjectTrafficScope(projectId, project.userId);
  const maxConcurrency = await resolveMaxConcurrencyForScope(scope);
  const trafficState = await prisma.generationTrafficState.findUnique({
    where: { scopeKey: scope.scopeKey },
    select: { runningVideoCount: true, dispatchTokens: true },
  });

  const logIds = tasks
    .map((t) => {
      const id = readPayload(t.inputPayload).gatewayLogId;
      return typeof id === "string" && id.trim() ? id.trim() : null;
    })
    .filter((x): x is string => x != null);

  const logs = logIds.length
    ? await prisma.gatewayRequestLog.findMany({
        where: { id: { in: logIds } },
        select: {
          id: true,
          status: true,
          providerKind: true,
          requestKind: true,
          durationMs: true,
          submittedAt: true,
          completedAt: true,
          resultSummary: true,
        },
      })
    : [];
  const logById = new Map(logs.map((l) => [l.id, l]));

  const nowMs = Date.now();
  const snapshots: I2vTaskSnapshot[] = tasks.map((t) => {
    const payload = readPayload(t.inputPayload);
    const gatewayLogId =
      typeof payload.gatewayLogId === "string" ? payload.gatewayLogId : null;
    const log = gatewayLogId ? logById.get(gatewayLogId) : undefined;

    let timing: I2vTaskTiming = {
      durationMs: null,
      queueMs: null,
      generateMs: null,
      vendorPostProcessMs: null,
      pollDelayMs: null,
      pollDelayOverLimit: false,
      sumDeltaMs: null,
    };
    if (log) {
      const breakdown = resolveVolcengineLogTiming({
        providerKind: log.providerKind,
        requestKind: log.requestKind,
        submittedAt: log.submittedAt,
        completedAt: log.completedAt,
        resultSummary: log.resultSummary,
        nowMs,
      });
      const durationMs =
        log.durationMs ??
        (log.completedAt
          ? log.completedAt.getTime() - log.submittedAt.getTime()
          : nowMs - log.submittedAt.getTime());
      const q = breakdown?.queueMs ?? null;
      const g = breakdown?.generateMs ?? null;
      const pp = breakdown?.vendorPostProcessMs ?? null;
      const p = breakdown?.pollDelayMs ?? null;
      const sum =
        q != null && g != null && pp != null && p != null
          ? q + g + pp + p
          : null;
      timing = {
        durationMs,
        queueMs: q,
        generateMs: g,
        vendorPostProcessMs: pp,
        pollDelayMs: p,
        pollDelayOverLimit: breakdown?.pollDelayOverLimit ?? false,
        sumDeltaMs: sum != null && durationMs != null ? durationMs - sum : null,
      };
    }

    return {
      id: t.id,
      nodeId: t.nodeId,
      status: t.status,
      kieTaskId: t.kieTaskId,
      gatewayLogId,
      gatewayStatus: log?.status ?? null,
      failCode: t.failCode,
      failMessage: t.failMessage,
      submittedAt: t.submittedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      pollCount: t.pollCount,
      ossUrl: t.ossUrl,
      timing,
    };
  });

  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  const total = tasks.length;
  const terminalCount = tasks.filter((t) => TERMINAL_STATUSES.has(t.status)).length;
  const inflightCount = tasks.filter((t) => INFLIGHT_STATUSES.has(t.status)).length;
  const runningVideoCount = trafficState?.runningVideoCount ?? 0;

  const verdicts = computeVerdicts({
    snapshots,
    total,
    counts,
    terminalCount,
    runningVideoCount,
    maxConcurrency,
    trafficControlEnabled: isTrafficControlEnabled(),
  });

  return {
    projectId,
    fetchedAt: new Date().toISOString(),
    trafficControlEnabled: isTrafficControlEnabled(),
    maxConcurrency,
    scopeKey: scope.scopeKey,
    runningVideoCount,
    dispatchTokens: trafficState?.dispatchTokens ?? null,
    counts,
    total,
    terminalCount,
    inflightCount,
    tasks: snapshots,
    verdicts,
  };
}

function computeVerdicts(input: {
  snapshots: I2vTaskSnapshot[];
  total: number;
  counts: Record<string, number>;
  terminalCount: number;
  runningVideoCount: number;
  maxConcurrency: number;
  trafficControlEnabled: boolean;
}): I2vVerdicts {
  const { snapshots, total, counts, terminalCount, runningVideoCount, maxConcurrency } =
    input;
  const succeeded = counts.SUCCEEDED ?? 0;
  const failed = counts.FAILED ?? 0;
  const allTerminal = total > 0 && terminalCount === total;

  // Q1 正常运行：无失败且全部跑完（或仍在进行中）
  let run: I2vVerdicts["run"];
  if (total === 0) {
    run = { verdict: "pending", detail: "尚未创建任务" };
  } else if (failed > 0) {
    run = {
      verdict: "fail",
      detail: `有 ${failed} 条失败（成功 ${succeeded} / 共 ${total}）`,
    };
  } else if (allTerminal) {
    run = { verdict: "pass", detail: `全部成功 ${succeeded}/${total}` };
  } else {
    run = {
      verdict: "pending",
      detail: `进行中：成功 ${succeeded} / 终态 ${terminalCount} / 共 ${total}`,
    };
  }

  // Q2 阻塞：限流生效 = 运行中的视频数从不超过 maxConcurrency（无超额并发）
  // 该快照值仅反映当前；峰值由前端跨轮询累计判定，这里给出当前是否越界。
  let blocking: I2vVerdicts["blocking"];
  if (!input.trafficControlEnabled) {
    blocking = {
      verdict: "fail",
      detail: "TRAFFIC_CONTROL_OFF=1，未启用排队限流",
    };
  } else if (runningVideoCount > maxConcurrency) {
    blocking = {
      verdict: "fail",
      detail: `运行中 ${runningVideoCount} > 并发上限 ${maxConcurrency}（超额并发，限流失效）`,
    };
  } else {
    blocking = {
      verdict: "pass",
      detail: `运行中 ${runningVideoCount} ≤ 并发上限 ${maxConcurrency}（限流生效）`,
    };
  }

  // Q3 阻塞释放：全部终态后，队列排空且槽位归零
  const queued = (counts.QUEUED ?? 0) + (counts.DISPATCHING ?? 0);
  let release: I2vVerdicts["release"];
  if (!allTerminal) {
    release = {
      verdict: "pending",
      detail: `等待排空：当前排队 ${queued} / 运行中槽位 ${runningVideoCount}`,
    };
  } else if (runningVideoCount !== 0) {
    release = {
      verdict: "fail",
      detail: `全部终态但槽位未归零（runningVideoCount=${runningVideoCount}），疑似槽位泄漏`,
    };
  } else {
    release = { verdict: "pass", detail: "队列已排空，槽位已全部释放（归零）" };
  }

  // Q4 五个时间正确：对每条成功任务，5 值齐全且 duration ≈ queue+generate+postProcess+poll
  const withTiming = snapshots.filter((s) => s.status === "SUCCEEDED");
  let timing: I2vVerdicts["timing"];
  if (withTiming.length === 0) {
    timing = { verdict: "pending", detail: "尚无成功任务可校验时间拆分" };
  } else {
    // 正确性问题（导致 fail）：四值缺失 / 生成为 0 / 总耗时与三段和不符
    const problems: string[] = [];
    // 健康度告警（不影响"时间是否正确"判定，仅提示轮询节奏）：轮询延迟超阈值
    let overLimit = 0;
    for (const s of withTiming) {
      const t = s.timing;
      if (
        t.queueMs == null ||
        t.generateMs == null ||
        t.vendorPostProcessMs == null ||
        t.pollDelayMs == null
      ) {
        problems.push(`${s.nodeId}: 时间拆分缺失`);
        continue;
      }
      if (t.generateMs <= 0) problems.push(`${s.nodeId}: 厂商生成时间为 0`);
      // duration 与四段和的偏差容忍 2s（轮询/写库的小抖动）
      if (t.sumDeltaMs != null && Math.abs(t.sumDeltaMs) > 2000) {
        problems.push(
          `${s.nodeId}: 总耗时与三段和偏差 ${Math.round(t.sumDeltaMs)}ms`,
        );
      }
      if (t.pollDelayOverLimit) overLimit++;
    }
    if (problems.length) {
      timing = { verdict: "fail", detail: problems.slice(0, 6).join("；") };
    } else {
      const warn =
        overLimit > 0
          ? `；⚠ ${overLimit} 条轮询延迟>${GATEWAY_POLL_DELAY_LIMIT_MS / 1000}s（轮询节奏，非时间计算问题，生产建议常驻 gateway:poll-loop）`
          : "";
      timing = {
        verdict: "pass",
        detail: `已校验 ${withTiming.length} 条：五时间齐全且总耗时≈排队+生成+后处理+Poll${warn}`,
      };
    }
  }

  return { run, blocking, release, timing };
}

export async function tickI2vLoadTest(projectId: string): Promise<I2vLoadTestStatus> {
  const { runCanvasPollWorker } = await import("@/lib/canvas/canvas-task-service");
  await runCanvasPollWorker({ projectId });
  return getI2vLoadTestStatus(projectId);
}

function clampInt(v: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
