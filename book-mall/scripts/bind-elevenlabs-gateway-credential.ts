/**
 * 将有效的 ElevenLabs API Key（sk_ 开头）写入 canonical 平台凭证池并刷新 sk-gw 绑定。
 *
 * 用法（勿将 Key 写入仓库）：
 *   cd book-mall
 *   ELEVENLABS_API_KEY='sk_...' pnpm qr:bind-elevenlabs-gateway
 *
 * 可选指定 canonical 平台账号邮箱：
 *   ELEVENLABS_API_KEY='sk_...' pnpm qr:bind-elevenlabs-gateway 13808816802@126.com
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createGatewayCredential,
  getDecryptedCredentialApiKey,
  updateGatewayCredential,
} from "../lib/gateway/credential-service";
import { forwardElevenLabsListVoices } from "../lib/gateway/elevenlabs-proxy";
import {
  ELEVENLABS_DEFAULT_API_ROOT,
  assertElevenLabsApiKeyFormat,
} from "../lib/gateway/elevenlabs-models";
import { getCanonicalPlatformPoolOwnerEmail } from "../lib/gateway/platform-credential-copy";
import {
  rebindManagedKeysToPlatformPool,
  syncCanonicalPlatformAdminKeyBindings,
} from "../lib/gateway/platform-credential-pool";
import { prisma } from "../lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "../lib/gateway/sync-user";

const ELEVENLABS_MD = resolve(__dirname, "../../docs/elevenlabs.md");
const ELEVENLABS_ALIAS = "ElevenLabs";

function resolveElevenLabsApiKeyFromArgv(): string | null {
  return process.argv.slice(2).find((a) => a.startsWith("sk_"))?.trim() ?? null;
}

function resolveElevenLabsApiKeyFromDoc(): string | null {
  try {
    const text = readFileSync(ELEVENLABS_MD, "utf8");
    const line = text.match(/^API\s*:\s*(\S+)/im);
    const key = line?.[1]?.trim();
    return key?.startsWith("sk_") ? key : null;
  } catch {
    return null;
  }
}

async function main() {
  const apiKey =
    process.env.ELEVENLABS_API_KEY?.trim() ||
    resolveElevenLabsApiKeyFromArgv() ||
    resolveElevenLabsApiKeyFromDoc() ||
    "";
  try {
    assertElevenLabsApiKeyFormat(apiKey);
  } catch (e) {
    console.error(
      e instanceof Error ? e.message : "ElevenLabs API Key 格式无效",
    );
    console.error(
      "\n请在 ElevenLabs 控制台创建/轮换 API Key（sk_ 开头），然后：",
    );
    console.error("  ELEVENLABS_API_KEY='sk_...' pnpm --dir book-mall qr:bind-elevenlabs-gateway");
    console.error("\n注意：docs/elevenlabs.md 的 `API :` 行若是 Key ID（非 sk_），不能用作 API Key。");
    process.exit(1);
  }

  const emailArg =
    process.argv.slice(2).find((a) => a.includes("@"))?.trim() ||
    getCanonicalPlatformPoolOwnerEmail();
  const bookUser = await prisma.user.findFirst({
    where: { email: emailArg },
    select: { id: true, email: true, name: true },
  });
  if (!bookUser) {
    console.error(`未找到 Book 用户: ${emailArg}`);
    process.exit(1);
  }

  await syncGatewayUserFromBookUser({
    bookUserId: bookUser.id,
    email: bookUser.email,
    name: bookUser.name,
  });
  const gwUser = await findGatewayUserByBookUserId(bookUser.id);
  if (!gwUser) {
    console.error("Gateway 用户同步失败");
    process.exit(1);
  }

  const existing = await prisma.gatewayVendorCredential.findFirst({
    where: {
      userId: gwUser.id,
      providerKind: "ELEVENLABS",
      channel: "platform-pool",
    },
    orderBy: [{ isDefaultForProvider: "desc" }, { updatedAt: "desc" }],
    select: { id: true, alias: true },
  });

  let credentialId: string;
  if (existing) {
    await updateGatewayCredential(gwUser.id, existing.id, {
      apiKey,
      active: true,
      baseUrl: ELEVENLABS_DEFAULT_API_ROOT,
      channel: "platform-pool",
      isDefaultForProvider: true,
    });
    credentialId = existing.id;
    console.log(`[ok] 已更新 ElevenLabs 凭证 alias=${existing.alias} id=${credentialId}`);
  } else {
    const created = await createGatewayCredential({
      userId: gwUser.id,
      alias: ELEVENLABS_ALIAS,
      providerKind: "ELEVENLABS",
      apiKey,
      baseUrl: ELEVENLABS_DEFAULT_API_ROOT,
      channel: "platform-pool",
      isDefaultForProvider: true,
    });
    credentialId = created.id;
    console.log(`[ok] 已创建 ElevenLabs 凭证 id=${credentialId}`);
  }

  await syncCanonicalPlatformAdminKeyBindings(gwUser.id);
  const { updated } = await rebindManagedKeysToPlatformPool();
  console.log(`[ok] Platform Admin / 托管 sk-gw 绑定已刷新: ${updated} 把`);

  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) {
    console.error("[warn] 凭证解密失败，跳过连通性探测");
    return;
  }

  console.log("\n== 连通性：GET /v1/voices ==");
  const probe = await forwardElevenLabsListVoices({ credentialId });
  if (probe.status < 200 || probe.status >= 300) {
    console.error(`[fail] HTTP ${probe.status} voices=${probe.voices.length}`);
    process.exit(1);
  }
  console.log(`[ok] voices=${probe.voices.length} sample=${probe.voices.slice(0, 3).map((v) => v.name).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
