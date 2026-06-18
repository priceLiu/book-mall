/**
 * 冒烟：火山私域人像 Open API（AK/SK · ListAssetGroups / CreateAsset / GetAsset）
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-volcengine-portrait.ts
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-volcengine-portrait.ts --url https://example.com/face.png
 */
import {
  buildPortraitAssetUri,
  volcengineCreatePortraitAsset,
  volcengineGetPortraitAsset,
  volcengineResolveOrCreateAigcGroup,
} from "../lib/gateway/volcengine-portrait-actions";
import { resolveVolcenginePortraitCredentialsFromEnv } from "../lib/gateway/volcengine-portrait-credentials";

async function main() {
  const credentials = resolveVolcenginePortraitCredentialsFromEnv();
  if (!credentials) {
    console.error(
      "请配置 VOLCENGINE_ACCESS_KEY + VOLCENGINE_SECRET_ACCESS_KEY（.env.local）",
    );
    process.exit(1);
  }

  const testUrl =
    process.argv.find((a) => a.startsWith("https://")) ??
    process.argv.find((a) => a.startsWith("--url="))?.slice(6);

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
