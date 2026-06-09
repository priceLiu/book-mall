/**
 * 将 source 账号已关联的 Personal sk-gw 所绑定的厂商凭证，复制到 target 并重新绑定。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/copy-gateway-from-user.ts \
 *     --source=13808816802@126.com --target=123456789@126.com [--confirm]
 *
 * 说明：sk-gw 字符串不能跨账号共用（每用户独立密钥）；复制的是厂商 API Key 与绑定关系。
 */
import type { GatewayProviderKind } from "@prisma/client";

import { decryptApiKey } from "../lib/canvas/secret";
import { createGatewayApiKey } from "../lib/gateway/api-key-service";
import { createGatewayCredential, updateGatewayCredential } from "../lib/gateway/credential-service";
import { PERSONAL_KEY_DEFAULT_NAME } from "../lib/gateway/key-scope";
import { prisma } from "../lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "../lib/gateway/sync-user";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const sourceEmail = arg("source")?.trim();
  const targetEmail = arg("target")?.trim();
  if (!sourceEmail || !targetEmail) {
    throw new Error("用法: --source=... --target=... [--confirm]");
  }
  const confirm = hasFlag("confirm");

  const [sourceBook, targetBook] = await Promise.all([
    prisma.user.findUnique({
      where: { email: sourceEmail },
      select: { id: true, email: true, name: true, gatewayApiKeyId: true },
    }),
    prisma.user.findUnique({
      where: { email: targetEmail },
      select: { id: true, email: true, name: true, gatewayApiKeyId: true },
    }),
  ]);

  if (!sourceBook?.gatewayApiKeyId) {
    throw new Error(`source ${sourceEmail} 未关联 Gateway Personal Key`);
  }
  if (!targetBook) throw new Error(`未找到 target ${targetEmail}`);

  const sourceKey = await prisma.gatewayApiKey.findUnique({
    where: { id: sourceBook.gatewayApiKeyId },
    include: {
      bindings: { include: { credential: true } },
      user: { select: { email: true } },
    },
  });
  if (!sourceKey || sourceKey.revokedAt) {
    throw new Error("source 关联的 Gateway Key 无效");
  }

  const sourceCreds = sourceKey.bindings.map((b) => b.credential).filter((c) => c.active);
  console.log(`[copy-gw] ${confirm ? "执行" : "DRY-RUN"}: ${targetEmail} ← ${sourceEmail}`);
  console.log(
    `[copy-gw] source Personal Key ${sourceKey.keyPrefix}… · ${sourceCreds.length} 条厂商凭证`,
  );
  console.log(
    `[copy-gw] 凭证:`,
    sourceCreds.map((c) => `${c.providerKind}/${c.alias}`).join(", "),
  );

  if (!confirm) {
    console.log("[copy-gw] 预览完成。加 --confirm 执行。");
    return;
  }

  await syncGatewayUserFromBookUser({
    bookUserId: targetBook.id,
    email: targetBook.email!,
    name: targetBook.name,
  });
  const targetGw = await findGatewayUserByBookUserId(targetBook.id);
  if (!targetGw) throw new Error("target GatewayUser 同步失败");

  const copiedIds: string[] = [];

  for (const src of sourceCreds) {
    let plain: string;
    try {
      plain = decryptApiKey(src.apiKeyEncrypted);
    } catch {
      console.warn(`[copy-gw] 跳过 ${src.alias}（解密失败）`);
      continue;
    }

    const existing = await prisma.gatewayVendorCredential.findFirst({
      where: {
        userId: targetGw.id,
        providerKind: src.providerKind,
        alias: src.alias,
      },
    });

    if (existing) {
      await updateGatewayCredential(targetGw.id, existing.id, {
        apiKey: plain,
        baseUrl: src.baseUrl,
        active: src.active,
        channel: src.channel ?? "copy-from-user",
        isDefaultForProvider: src.isDefaultForProvider,
      });
      copiedIds.push(existing.id);
    } else {
      const row = await createGatewayCredential({
        userId: targetGw.id,
        alias: src.alias,
        providerKind: src.providerKind as GatewayProviderKind,
        apiKey: plain,
        baseUrl: src.baseUrl,
        channel: src.channel ?? "copy-from-user",
        isDefaultForProvider: src.isDefaultForProvider,
      });
      copiedIds.push(row.id);
    }
  }

  if (copiedIds.length === 0) {
    throw new Error("未能复制任何凭证");
  }

  let targetPersonal = targetBook.gatewayApiKeyId
    ? await prisma.gatewayApiKey.findFirst({
        where: {
          id: targetBook.gatewayApiKeyId,
          userId: targetGw.id,
          scope: "PERSONAL",
          revokedAt: null,
        },
      })
    : null;

  if (!targetPersonal) {
    const created = await createGatewayApiKey({
      userId: targetGw.id,
      name: PERSONAL_KEY_DEFAULT_NAME,
      scope: "PERSONAL",
      credentialIds: copiedIds,
    });
    targetPersonal = created.apiKey;
  } else {
    await prisma.gatewayApiKeyCredential.deleteMany({ where: { apiKeyId: targetPersonal.id } });
    await prisma.gatewayApiKeyCredential.createMany({
      data: copiedIds.map((credentialId) => ({ apiKeyId: targetPersonal!.id, credentialId })),
      skipDuplicates: true,
    });
  }

  await prisma.user.update({
    where: { id: targetBook.id },
    data: {
      gatewayApiKeyId: targetPersonal.id,
      gatewayApiKeyLinkedAt: new Date(),
    },
  });

  // 清理 target 上其它未关联的 Personal Key，避免多把 sk-gw 混淆
  await prisma.gatewayApiKey.updateMany({
    where: {
      userId: targetGw.id,
      scope: "PERSONAL",
      revokedAt: null,
      id: { not: targetPersonal.id },
    },
    data: { revokedAt: new Date() },
  });

  const after = await prisma.gatewayApiKey.findUnique({
    where: { id: targetPersonal.id },
    include: { bindings: { include: { credential: { select: { alias: true, providerKind: true } } } } },
  });

  console.log(`[copy-gw] 完成 · target Personal ${after?.keyPrefix}…`);
  console.log(
    `[copy-gw] 已绑定 ${after?.bindings.length ?? 0} 条:`,
    after?.bindings.map((b) => `${b.credential.providerKind}/${b.credential.alias}`).join(", "),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
