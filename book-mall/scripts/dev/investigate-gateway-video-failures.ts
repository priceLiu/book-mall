/**
 * 一次性排查：submit 直接失败（无 taskId）的提示词；厂商停更 RUNNING 任务现网状态。
 * 用法：cd book-mall && pnpm exec tsx scripts/dev/investigate-gateway-video-failures.ts
 */
import { PrismaClient } from "@prisma/client";

import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";
import { volcengineGetVideoTask } from "@/lib/gateway/volcengine-client";

const prisma = new PrismaClient();

function extractPrompt(inputSummary: unknown): string {
  if (!inputSummary || typeof inputSummary !== "object") return "";
  const root = inputSummary as Record<string, unknown>;
  const input =
    root.input && typeof root.input === "object" && !Array.isArray(root.input)
      ? (root.input as Record<string, unknown>)
      : root;

  if (typeof input.prompt === "string" && input.prompt.trim()) {
    return input.prompt.trim();
  }

  const content = input.content;
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.text === "string" && row.text.trim()) {
        texts.push(row.text.trim());
      }
    }
    if (texts.length) return texts.join(" | ");
  }

  return "";
}

async function main() {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const submitFails = await prisma.gatewayRequestLog.findMany({
    where: {
      requestKind: "VIDEO",
      status: "FAILED",
      externalTaskId: null,
      submittedAt: { gte: since },
      OR: [
        { failCode: "UPSTREAM_SUBMIT_FAILED" },
        { failCode: "INVALID_INPUT" },
        { failCode: "CONTENT_POLICY" },
      ],
    },
    orderBy: { submittedAt: "desc" },
    take: 30,
    select: {
      id: true,
      model: true,
      canonicalModelKey: true,
      failCode: true,
      failMessage: true,
      vendorRequestId: true,
      submittedAt: true,
      durationMs: true,
      inputSummary: true,
      actorBookUserId: true,
    },
  });

  console.log("\n=== Submit 直接失败（无 Vendor Task ID）最近 7 天 ===\n");
  for (const row of submitFails) {
    const prompt = extractPrompt(row.inputSummary);
    const model = row.canonicalModelKey ?? row.model;
    console.log("---");
    console.log(`logId: ${row.id}`);
    console.log(`time: ${row.submittedAt.toISOString()}`);
    console.log(`model: ${model}`);
    console.log(`failCode: ${row.failCode}`);
    console.log(`failMessage: ${(row.failMessage ?? "").slice(0, 200)}`);
    console.log(`requestId: ${row.vendorRequestId ?? "—"}`);
    console.log(`prompt:\n${prompt || "(未解析到 prompt)"}`);

    if (model && prompt) {
      const succeededSameModel = await prisma.gatewayRequestLog.findMany({
        where: {
          requestKind: "VIDEO",
          status: "SUCCEEDED",
          submittedAt: { gte: since },
          OR: [{ canonicalModelKey: model }, { model }],
        },
        orderBy: { submittedAt: "desc" },
        take: 200,
        select: { id: true, submittedAt: true, externalTaskId: true, inputSummary: true },
      });
      const ok = succeededSameModel.find(
        (s) => extractPrompt(s.inputSummary) === prompt,
      );
      const similar = succeededSameModel.find((s) => {
        const p = extractPrompt(s.inputSummary);
        return p && prompt.slice(0, 40) === p.slice(0, 40);
      });
      console.log(
        ok
          ? `同类成功(同 prompt): 有 log ${ok.id.slice(0, 8)}…`
          : similar
            ? `同类成功(前缀相似): 有 log ${similar.id.slice(0, 8)}…`
            : `同类成功: 同 model 下 ${succeededSameModel.length} 条成功，无相同 prompt`,
      );
    }
  }

  const stallCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const stalled = await prisma.gatewayRequestLog.findMany({
    where: {
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      submittedAt: { gte: since },
      OR: [
        { failCode: "VOLCENGINE_GATEWAY_POLL_STALL" },
        {
          status: "RUNNING",
          submittedAt: { lt: stallCutoff },
        },
      ],
    },
    orderBy: { submittedAt: "asc" },
    take: 15,
    select: {
      id: true,
      status: true,
      failCode: true,
      externalTaskId: true,
      credentialId: true,
      submittedAt: true,
      lastPolledAt: true,
      resultSummary: true,
    },
  });

  console.log("\n=== 厂商停更 / RUNNING 火山视频（抽样 poll 现网）===\n");

  for (const row of stalled) {
    const taskId = row.externalTaskId?.trim();
    if (!taskId || !row.credentialId) continue;
    console.log("---");
    console.log(`logId: ${row.id} status=${row.status} failCode=${row.failCode ?? "—"}`);
    console.log(`vendorTaskId: ${taskId}`);
    console.log(`submitted: ${row.submittedAt.toISOString()} lastPoll: ${row.lastPolledAt?.toISOString() ?? "—"}`);

    try {
      const cred = await getDecryptedCredentialApiKey(row.credentialId);
      if (!cred) {
        console.log("vendor poll: 凭证不可用");
        continue;
      }
      const polled = await volcengineGetVideoTask({
        apiKey: resolveVolcengineArkApiKey(cred.apiKey),
        baseUrl: cred.baseUrl,
        taskId,
      });
      const out = polled.output;
      console.log(
        `vendor poll: status=${out.status} error=${JSON.stringify(out.error ?? null)}`,
      );
      if (out.content?.video_url) {
        console.log(`video_url: ${out.content.video_url.slice(0, 120)}…`);
      }
    } catch (e) {
      console.log(`vendor poll error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
