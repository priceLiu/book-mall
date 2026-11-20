/**
 * 全链路并发。仅 /dev。
 *
 * 5 文本：画布 ai-engine → Gateway chat（deepseek-chat）
 * 5 生图：电商工具箱 generateEcomImage（z-image-turbo）
 * 5 视频：一键复刻文生视频（wan3.0-video，最短 2 秒、720P、无声）
 * 另外占用 2 条数据库连接，页面上可以释放。
 */
import type { Prisma } from "@prisma/client";

import { applyMockCreditTopup } from "@/lib/billing/apply-mock-credit-topup";
import { canvasGwChat } from "@/lib/canvas/canvas-gateway-client";
import { createCanvasProjectForUser } from "@/lib/canvas/canvas-project-service";
import { createStoryScopedCanvasTask } from "@/lib/canvas/canvas-story-scope";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { dispatchQueuedCanvasTasks } from "@/lib/generation/traffic-control/dispatch-canvas";
import { prisma } from "@/lib/prisma";
import { qrCreateTextToVideoJob } from "@/lib/quick-replica/qr-text-to-video-service";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

const TEXT_MODEL = "deepseek-chat";
const IMAGE_MODEL = "z-image-turbo";
const VIDEO_MODEL = "wan3.0-video";
const TEXT_COUNT = 5;
const IMAGE_COUNT = 5;
const VIDEO_COUNT = 5;
const HOLD_COUNT = 2;
const MIN_BALANCE = 800;

type HeldConnection = { id: string; startedAt: number; release: () => void };
const heldConnections = new Map<string, HeldConnection>();

export function listHeldConnections() {
  return [...heldConnections.values()].map((hold) => ({
    id: hold.id,
    ageMs: Date.now() - hold.startedAt,
  }));
}

export function releaseHeldConnections(ids?: string[]) {
  const targets = ids?.length ? ids : [...heldConnections.keys()];
  let released = 0;
  for (const id of targets) {
    const hold = heldConnections.get(id);
    if (!hold) continue;
    hold.release();
    released += 1;
  }
  return { released, remaining: heldConnections.size };
}

export async function holdDbConnections(count = HOLD_COUNT) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `hold-${Date.now()}-${i}`;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const timer = setTimeout(finish, 45_000);
    const release = () => {
      clearTimeout(timer);
      heldConnections.delete(id);
      finish();
    };
    heldConnections.set(id, { id, startedAt: Date.now(), release });
    void prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT 1`;
          await gate;
        },
        { timeout: 50_000, maxWait: 8_000 },
      )
      .catch(() => undefined)
      .finally(() => {
        heldConnections.delete(id);
      });
    ids.push(id);
  }
  return ids;
}

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

async function runEcomImageTask(input: { projectId: string; userId: string; index: number }) {
  const prompt = `白底上一个红色圆点，编号 ${input.index}`;
  const task = await createStoryScopedCanvasTask({
    projectId: input.projectId,
    nodeId: `gen-load-image-${input.index}`,
    actorUserId: input.userId,
    initialStatus: "SUBMITTED",
    data: {
      kind: "IMAGE",
      model: IMAGE_MODEL,
      providerId: null,
      inputHash: `gen-load-ecom:${input.projectId}:${input.index}:${Date.now()}`,
      inputPayload: {
        source: "ecom",
        prompt,
        modelKey: IMAGE_MODEL,
        clientPage: `ecom/${input.userId}/${input.projectId}/gen-load-test`,
      } as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });
  try {
    const url = await generateEcomImage({
      userId: input.userId,
      modelKey: IMAGE_MODEL,
      prompt,
      ratio: "1:1",
      imageSize: "1K",
      promptExtend: false,
      refImageUrls: [],
      toolKey: "gen-load-test",
      workspaceId: input.projectId,
    });
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "SUCCEEDED",
        ossUrl: url,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: "ECOM_IMAGE_FAILED",
        failMessage: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        completedAt: new Date(),
      },
    });
  }
  return task.id;
}

function videoDraft(index: number): QrWorkspaceDraft {
  return {
    category: "video",
    kind: "text-to-video",
    title: `全链路视频 ${index}`,
    targetImageUrl: "",
    referenceVideoUrl: "",
    referenceAudioUrl: "",
    sceneImageUrls: [],
    prompt: `镜头缓慢推近一个红色圆点，白底，编号 ${index}`,
    modelKey: VIDEO_MODEL,
    resolution: "720P",
    aspectRatio: "16:9",
    duration: 2,
    keepOriginalSound: false,
  };
}

async function runReplicaVideoTask(input: { projectId: string; userId: string; index: number }) {
  const task = await createStoryScopedCanvasTask({
    projectId: input.projectId,
    nodeId: `gen-load-video-${input.index}`,
    actorUserId: input.userId,
    initialStatus: "SUBMITTED",
    data: {
      kind: "IMAGE",
      model: VIDEO_MODEL,
      providerId: null,
      inputHash: `gen-load-qr:${input.projectId}:${input.index}:${Date.now()}`,
      inputPayload: {
        source: "quick-replica",
        modelKey: VIDEO_MODEL,
        duration: 2,
        clientPage: "quick-replica/text-to-video",
      } as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });
  try {
    const job = await qrCreateTextToVideoJob(input.userId, videoDraft(input.index));
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        kieTaskId: job.taskId,
        inputPayload: {
          source: "quick-replica",
          modelKey: VIDEO_MODEL,
          duration: 2,
          gatewayLogId: job.logId,
          clientPage: "quick-replica/text-to-video",
        } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: "QR_VIDEO_FAILED",
        failMessage: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        completedAt: new Date(),
      },
    });
  }
  return task.id;
}

async function ensureTestCredits(userId: string, balance: number) {
  if (balance >= MIN_BALANCE) return { toppedUp: false as const, credits: 0 };
  const topup = await applyMockCreditTopup({
    userId,
    packId: "pack-light",
    target: "personal",
  });
  return { toppedUp: true as const, credits: topup.credits, balanceAfter: topup.balanceAfter, orderId: topup.orderId };
}

export async function startGenLoadTest(input?: { userId?: string }) {
  const user = await resolveGenLoadTestUser(input?.userId);
  const topup = await ensureTestCredits(user.userId, user.balance);
  const holdIds = await holdDbConnections(HOLD_COUNT);
  const project = await createCanvasProjectForUser(user.userId, {
    name: `[全链路并发] ${new Date().toISOString().slice(11, 19)}`,
    description: "5 文本 + 5 电商生图 + 5 一键复刻短视频",
    canvas: {
      schemaVersion: 1,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      meta: { devGenLoadTest: true },
    },
  });

  const [textIds, imageIds, videoIds] = await Promise.all([
    Promise.all(
      Array.from({ length: TEXT_COUNT }, (_, i) =>
        runTextTask({ projectId: project.id, userId: user.userId, index: i + 1 }),
      ),
    ),
    Promise.all(
      Array.from({ length: IMAGE_COUNT }, (_, i) =>
        runEcomImageTask({ projectId: project.id, userId: user.userId, index: i + 1 }),
      ),
    ),
    Promise.all(
      Array.from({ length: VIDEO_COUNT }, (_, i) =>
        runReplicaVideoTask({ projectId: project.id, userId: user.userId, index: i + 1 }),
      ),
    ),
  ]);

  return {
    projectId: project.id,
    projectName: project.name,
    userId: user.userId,
    balanceBefore: user.balance,
    reservedBefore: user.reserved,
    topup,
    holdIds,
    textCount: TEXT_COUNT,
    imageCount: IMAGE_COUNT,
    videoCount: VIDEO_COUNT,
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL,
    videoModel: VIDEO_MODEL,
    textIds,
    imageIds,
    videoIds,
  };
}

export async function tickGenLoadTest(projectId: string) {
  const dispatch = await dispatchQueuedCanvasTasks({ projectId }).catch(() => null);
  const status = await getGenLoadTestStatus(projectId);
  return { dispatch, ...status };
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

  const ecomLogs = await prisma.gatewayRequestLog.findMany({
    where: { clientPage: { contains: projectId }, requestKind: "IMAGE" },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      status: true,
      creditsCharged: true,
      failCode: true,
      failMessage: true,
      model: true,
    },
  });
  const logIds = [
    ...tasks.map((t) => readGatewayLogId(t.inputPayload)).filter((id): id is string => Boolean(id)),
    ...ecomLogs.map((l) => l.id),
  ];
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

  let ecomCursor = 0;
  const rows = tasks.map((task) => {
    const lane = task.nodeId.includes("-text-")
      ? "text"
      : task.nodeId.includes("-video-")
        ? "video"
        : "image";
    const gatewayLogId =
      readGatewayLogId(task.inputPayload) ??
      (lane === "image" ? ecomLogs[ecomCursor++]?.id ?? null : null);
    const log = gatewayLogId ? logById.get(gatewayLogId) : undefined;
    const gatewayTerminal =
      log?.status === "SUCCEEDED" || log?.status === "FAILED" || log?.status === "CANCELLED";
    return {
      id: task.id,
      nodeId: task.nodeId,
      lane,
      kind: task.kind,
      status: lane === "video" && gatewayTerminal && log ? log.status : task.status,
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
    holds: listHeldConnections(),
    total: rows.length,
    terminalCount: rows.filter((r) => terminal.has(r.status)).length,
    tasks: rows,
  };
}
