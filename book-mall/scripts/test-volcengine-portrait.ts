/**
 * 冒烟：火山私域人像 Open API（Gateway VOLCENGINE 凭证 · IAM AK/SK）
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-volcengine-portrait.ts [book-user-email]
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-volcengine-portrait.ts --url https://example.com/face.png
 */
import {
  buildPortraitAssetUri,
  volcengineCreatePortraitAsset,
  volcengineGetPortraitAsset,
  volcengineResolveOrCreateAigcGroup,
} from "../lib/gateway/volcengine-portrait-actions";
import { getDecryptedCredentialApiKey } from "../lib/gateway/credential-service";
import { resolveVolcenginePortraitCredentials } from "../lib/gateway/volcengine-gateway-credential";
import { pickSbv1VolcengineCredentialId } from "../lib/gateway/volcengine-credential-pick";
import { resolveGatewayAuthForBookUser } from "../lib/gateway/book-gateway-link";
import { prisma } from "../lib/prisma";

async function main() {
  const emailArg = process.argv.find((a) => a.includes("@"))?.trim();
  const bookUser = emailArg
    ? await prisma.user.findFirst({
        where: { email: emailArg },
        select: { id: true, email: true },
      })
    : await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true },
      });

  if (!bookUser) {
    console.error("未找到 Book 用户，请传入 email 参数");
    process.exit(1);
  }

  const auth = await resolveGatewayAuthForBookUser(bookUser.id);
  if (!auth) {
    console.error("Book 用户未关联 Gateway sk-gw");
    process.exit(1);
  }

  const credentialId = pickSbv1VolcengineCredentialId(auth.credentials);
  if (!credentialId) {
    console.error("Gateway Key 未绑定 VOLCENGINE 凭证");
    process.exit(1);
  }

  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred?.apiKey) {
    console.error("火山凭证不可用");
    process.exit(1);
  }

  let credentials;
  try {
    credentials = resolveVolcenginePortraitCredentials(cred.apiKey);
  } catch (e) {
    console.error(
      e instanceof Error ? e.message : String(e),
    );
    console.error(
      "请在 Gateway 控制台编辑火山方舟凭证，填写 IAM Access Key / Secret Access Key",
    );
    process.exit(1);
  }

  const testUrl =
    process.argv.find((a) => a.startsWith("https://")) ??
    process.argv.find((a) => a.startsWith("--url="))?.slice(6);

  console.log("Book 用户:", bookUser.email);
  console.log("AK", credentials.accessKeyId.slice(0, 8) + "…");

  const groupId = await volcengineResolveOrCreateAigcGroup({
    credentials,
    preferredName: "Canvas虚拟人像",
  });
  console.log("groupId", groupId);

  if (!testUrl) {
    console.log("跳过 CreateAsset（传入 https:// 图片 URL 可完整测试）");
    return;
  }

  const created = await volcengineCreatePortraitAsset({
    credentials,
    groupId,
    url: testUrl,
    name: "portrait-smoke-test",
  });
  console.log("created", created.id, created.status, buildPortraitAssetUri(created.id));

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const asset = await volcengineGetPortraitAsset({
      credentials,
      assetId: created.id,
    });
    console.log("poll", i + 1, asset.status);
    if (asset.status === "Active" || asset.status === "Failed") break;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
