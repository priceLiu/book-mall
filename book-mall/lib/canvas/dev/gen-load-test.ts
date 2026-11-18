/**
 * 画布生图 + 生文本全链路并发。仅 /dev。
 *
 * 文本：与画布 ai-engine 相同，createStoryScopedCanvasTask 后 canvasGwChat 进 Gateway。
 * 生图：image-engine 入队后走 dispatchOneCanvasQueuedTask（占槽 → 百炼文生图 → 回写任务）。
 * 固定 5 条文本 + 5 条生图，一起发出。
 */
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canvasGwChat } from "@/lib/canvas/canvas-gateway-client";
import { createCanvasProjectForUser } from "@/lib/canvas/canvas-project-service";
import { createStoryScopedCanvasTask } from "@/lib/canvas/canvas-story-scope";
import {
  dispatchOneCanvasQueuedTask,
  dispatchQueuedCanvasTasks,
} from "@/lib/generation/traffic-control/dispatch-canvas";

const TEXT_MODEL = "deepseek-chat";
const IMAGE_MODEL = "z-image-turbo";
const TEXT_COUNT = 5;
const IMAGE_COUNT = 5;

export async function resolveGenLoadTestUser(userId?: string) {
  const wanted = userId?.trim();
  const users = await prisma.user.findMany({
    where: {
      gatewayApiKeyId: { not: null },
      ...(wanted ? { id: wanted } : {}),
    },
    select: { id: true, gatewayApiKeyId: true },
    take: wanted ? 1 : 20,
  });
  for (const user of users) {
    if (!user.gatewayApiKeyId) continue;
    const key = await prisma.gatewayApiKey.findUnique({
      where: { id: user.gatewayApiKeyId },
      select: {
        revokedAt: true,
        bindings: { select: { credential: { select: { providerKind: true, active: true } } } },
      },
    });
    if (!key || key.revokedAt) continue;
    const kinds = new Set(
      key.bindings.filter((b) => b.credential.active).map((b) => b.credential.providerKind),
    );
    if (!kinds.has("DEEPSEEK") || !kinds.has("DASHSCOPE")) continue;
    const account = await prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: user.id } },
      select: { balanceCredits: true, reservedCredits: true },
    });
    return {
      userId: user.id,
      balance: account ? Number(account.balanceCredits) : 0,
      reserved: account ? Number(account.reservedCredits) : 0,
    };
  }
  throw new Error("没有同时绑定 DeepSeek 与百炼、且已关联 Gateway Key 的用户");
}

async function runTextTask(input: {
  projectId: string;
  userId: string;
  index: number;
}) {
  const prompt = `只用一个数字回答：${input.index}+1 等于几？`;
  const task = await createStoryScopedCanvasTask({
    projectId: input.projectId,
    nodeId: `gen-load-text-${input.index}`,
    actorUserId: input.userId,
    initialStatus: "SUBMITTED",
    data: {
      kind: "TEXT",
      model: TEXT_MODEL,
      providerId: null,
      inputHash: `gen-load-text:${input.projectId}:${input.index}:${Date.now()}`,
      inputPayload: {
        kind: "ai-engine",
        prompt,
        params: { max_tokens: 16 },
        providerId: "gateway",
        modelKey: TEXT_MODEL,
        imageUrls: [],
        textInputs: [],
        clientPage: `canvas/${input.projectId}`,
      } as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });

  try {
    const resp = await canvasGwChat(input.userId, {
      modelKey: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      params: { max_tokens: 16 },
      clientPage: `canvas/${input.projectId}`,
      projectId: input.projectId,
      canvasTaskId: task.id,
    });
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "SUCCEEDED",
        textOutput: resp.text,
        resultPayload: (resp.rawPayload ?? null) as Prisma.InputJsonValue | undefined,
        inputPayload: {
          kind: "ai-engine",
          prompt,
          params: { max_tokens: 16 },
          providerId: "gateway",
          modelKey: TEXT_MODEL,
          gatewayLogId: resp.logId,
          clientPage: `canvas/${input.projectId}`,
        } as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return task.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: "AI_ENGINE_FAILED",
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return task.id;
  }
}

async function releaseStaleImageClaims(projectId: string) {
  const rows = await prisma.canvasGenerationTask.findMany({
    where: { projectId, status: "QUEUED", nodeId: { startsWith: "gen-load-image-" } },
    select: { id: true, inputPayload: true },
  });
  for (const row of rows) {
    const payload =
      row.inputPayload && typeof row.inputPayload === "object" && !Array.isArray(row.inputPayload)
        ? (row.inputPayload as Record<string, unknown>)
        : {};
    if (payload.gatewayLogId || payload.gatewayKieSubmitClaimed !== true) continue;
    await prisma.canvasGenerationTask.update({
      where: { id: row.id },
      data: {
        dispatchAfter: null,
        inputPayload: {
          ...payload,
          gatewayKieSubmitClaimed: false,
          syncGatewaySubmit: true,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

async function createImageTask(input: {
  projectId: string;
  userId: string;
  index: number;
}) {
  const prompt = `白底上一个红色圆点，编号 ${input.index}`;
  const task = await createStoryScopedCanvasTask({
    projectId: input.projectId,
    nodeId: `gen-load-image-${input.index}`,
    actorUserId: input.userId,
    initialStatus: "QUEUED",
    data: {
      kind: "IMAGE",
      model: IMAGE_MODEL,
      providerId: null,
      inputHash: `gen-load-image:${input.projectId}:${input.index}:${Date.now()}`,
      dispatchAfter: new Date(0),
      inputPayload: {
        kind: "image-engine",
        prompt,
        params: { resolution: "1K", n: 1 },
        providerId: "gateway",
        modelKey: IMAGE_MODEL,
        imageUrls: [],
        clientPage: `canvas/${input.projectId}`,
      } as Prisma.InputJsonValue,
    },
  });
  return task.id;
}

export async function startGenLoadTest(input?: { userId?: string }) {
  const user = await resolveGenLoadTestUser(input?.userId);
  const project = await createCanvasProjectForUser(user.userId, {
    name: `[全链路并发] ${new Date().toISOString().slice(11, 19)}`,
    description: "5 文本 + 5 生图，画布流程进 Gateway",
  });

  const imageIds: string[] = [];
  for (let i = 0; i < IMAGE_COUNT; i++) {
    imageIds.push(
      await createImageTask({ projectId: project.id, userId: user.userId, index: i + 1 }),
    );
  }
  await prisma.canvasGenerationTask.updateMany({
    where: { id: { in: imageIds }, status: "QUEUED" },
    data: { dispatchAfter: null },
  });
  await releaseStaleImageClaims(project.id);
  const imageTasks = await prisma.canvasGenerationTask.findMany({
    where: { id: { in: imageIds } },
    include: { project: { select: { userId: true } } },
  });

  const [textIds, imageDispatch] = await Promise.all([
    Promise.all(
      Array.from({ length: TEXT_COUNT }, (_, i) =>
        runTextTask({ projectId: project.id, userId: user.userId, index: i + 1 }),
      ),
    ),
    Promise.all(
      imageTasks.map(async (task) => {
        try {
          const result = await dispatchOneCanvasQueuedTask(task);
          return { id: task.id, result };
        } catch (e) {
          return {
            id: task.id,
            result: "failed" as const,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    ),
  ]);

  return {
    projectId: project.id,
    projectName: project.name,
    userId: user.userId,
    balanceBefore: user.balance,
    reservedBefore: user.reserved,
    textCount: TEXT_COUNT,
    imageCount: IMAGE_COUNT,
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL,
    textIds,
    imageIds,
    imageDispatch,
  };
}

export async function tickGenLoadTest(projectId: string) {
  await prisma.canvasGenerationTask.updateMany({
    where: { projectId, status: "QUEUED", nodeId: { startsWith: "gen-load-image-" } },
    data: { dispatchAfter: null },
  });
  await releaseStaleImageClaims(projectId);
  const queued = await prisma.canvasGenerationTask.findMany({
    where: { projectId, status: "QUEUED", nodeId: { startsWith: "gen-load-image-" } },
    include: { project: { select: { userId: true } } },
  });
  const burst = await Promise.all(
    queued.map(async (task) => {
      try {
        return { id: task.id, result: await dispatchOneCanvasQueuedTask(task) };
      } catch (e) {
        return { id: task.id, result: "failed" as const, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  const dispatch = await dispatchQueuedCanvasTasks({ projectId });
  const status = await getGenLoadTestStatus(projectId);
  return { burst, dispatch, ...status };
}

function readGatewayLogId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const id = (payload as Record<string, unknown>).gatewayLogId;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function getGenLoadTestStatus(projectId: string) {
  const project = await prisma.canvasProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, userId: true },
  });
  if (!project) throw new Error("项目不存在");

  const tasks = await prisma.canvasGenerationTask.findMany({
    where: { projectId, nodeId: { startsWith: "gen-load-" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nodeId: true,
      kind: true,
      status: true,
      model: true,
      textOutput: true,
      ossUrl: true,
      ephemeralUrl: true,
      failCode: true,
      failMessage: true,
      inputPayload: true,
      submittedAt: true,
      completedAt: true,
    },
  });

  const logIds = tasks.map((t) => readGatewayLogId(t.inputPayload)).filter((id): id is string => Boolean(id));
  const logs = logIds.length
    ? await prisma.gatewayRequestLog.findMany({
        where: { id: { in: logIds } },
        select: {
          id: true,
          status: true,
          creditsCharged: true,
          failCode: true,
          failMessage: true,
          model: true,
        },
      })
    : [];
  const logById = new Map(logs.map((l) => [l.id, l]));
  const keys = logIds.flatMap((id) => [`reserve:${id}`, `settle:${id}`, `release:${id}`, `extra:${id}`]);
  const ledgers = keys.length
    ? await prisma.creditLedger.findMany({
        where: { idempotencyKey: { in: keys } },
        select: { idempotencyKey: true, type: true, credits: true },
      })
    : [];
  const ledgerByLog = new Map<string, { type: string; credits: number }[]>();
  for (const row of ledgers) {
    const key = row.idempotencyKey ?? "";
    const logId = key.split(":").slice(1).join(":");
    const list = ledgerByLog.get(logId) ?? [];
    list.push({ type: row.type, credits: Number(row.credits) });
    ledgerByLog.set(logId, list);
  }

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: project.userId } },
    select: { balanceCredits: true, reservedCredits: true },
  });

  const rows = tasks.map((task) => {
    const gatewayLogId = readGatewayLogId(task.inputPayload);
    const log = gatewayLogId ? logById.get(gatewayLogId) : undefined;
    return {
      id: task.id,
      nodeId: task.nodeId,
      lane: task.nodeId.includes("-text-") ? "text" : "image",
      kind: task.kind,
      status: task.status,
      model: task.model,
      textOutput: task.textOutput?.slice(0, 200) ?? null,
      ossUrl: task.ossUrl,
      ephemeralUrl: task.ephemeralUrl,
      failCode: task.failCode,
      failMessage: task.failMessage?.slice(0, 240) ?? null,
      gatewayLogId,
      gatewayStatus: log?.status ?? null,
      creditsCharged: log?.creditsCharged != null ? Number(log.creditsCharged) : null,
      gatewayFail: log?.failMessage?.slice(0, 240) ?? null,
      ledger: gatewayLogId ? (ledgerByLog.get(gatewayLogId) ?? []) : [],
    };
  });

  const terminal = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);
  return {
    ok: true as const,
    projectId: project.id,
    projectName: project.name,
    userId: project.userId,
    balance: account ? Number(account.balanceCredits) : null,
    reserved: account ? Number(account.reservedCredits) : null,
    total: rows.length,
    terminalCount: rows.filter((r) => terminal.has(r.status)).length,
    tasks: rows,
  };
}
