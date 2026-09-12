/**
 * Seedream 5.0 Pro · 图层拆分 + 交互编辑 POC（只读调试，不入库业务）
 *
 * 用法（勿将 ARK_API_KEY 写入仓库）：
 *   cd book-mall
 *   ARK_API_KEY='ark-...' pnpm exec dotenv -e .env.local -- tsx scripts/poc-seedream-image-layer.ts
 *
 * 或经平台池凭证（需 .env.local 数据库可达）：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/poc-seedream-image-layer.ts --platform-pool
 */
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { getCanonicalPlatformPoolOwnerEmail } from "@/lib/gateway/platform-credential-copy";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "@/lib/gateway/sync-user";
import {
  parseSeedreamLayerDecomposeResponse,
  volcengineImageGenerations,
} from "@/lib/gateway/volcengine-image-generations-proxy";
import { prisma } from "@/lib/prisma";

const MODEL = "doubao-seedream-5-0-pro-260628";
const SAMPLE_IMAGE =
  "https://arkdocs.tos-cn-beijing.volces.com/images/image-generation/edit-image.png";
const EDIT_BBOX: [number, number, number, number] = [179, 283, 796, 986];

async function resolveApiKey(usePlatformPool: boolean): Promise<string> {
  const envKey =
    process.env.ARK_API_KEY?.trim() || process.env.VOLCENGINE_API_KEY?.trim() || "";
  if (envKey) return envKey;

  if (!usePlatformPool) {
    console.error(
      "请设置 ARK_API_KEY，或加 --platform-pool 从 Gateway 平台池读取凭证",
    );
    process.exit(1);
  }

  const email = getCanonicalPlatformPoolOwnerEmail();
  const bookUser = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (!bookUser) {
    console.error(`未找到 Book 用户: ${email}`);
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

  const cred = await prisma.gatewayVendorCredential.findFirst({
    where: { userId: gwUser.id, providerKind: "VOLCENGINE", isDefaultForProvider: true },
    select: { id: true },
  });
  if (!cred) {
    console.error("平台池未绑定 VOLCENGINE 凭证");
    process.exit(1);
  }

  const plain = await getDecryptedCredentialApiKey(cred.id);
  if (!plain?.apiKey?.trim()) {
    console.error("无法解密 VOLCENGINE 凭证");
    process.exit(1);
  }
  return plain.apiKey.trim();
}

function printSection(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

async function main() {
  const usePlatformPool = process.argv.includes("--platform-pool");
  const apiKey = await resolveApiKey(usePlatformPool);

  printSection("Step 1 · 图层拆分 (size=auto, output_format=jpeg)");
  const decompose = await volcengineImageGenerations({
    apiKey,
    model: MODEL,
    prompt: "将图片进行精确图层分离，对图片做完整图层语义分离。",
    image: SAMPLE_IMAGE,
    parameters: { size: "auto", output_format: "jpeg", layer_decomposition: true },
  });

  if (!decompose.ok) {
    console.error("拆分失败:", decompose.error);
    process.exit(1);
  }

  console.log("images count:", decompose.images.length);
  console.log("raw data[] sample:", JSON.stringify(decompose.raw.data, null, 2));
  const layers = parseSeedreamLayerDecomposeResponse(decompose.raw);
  console.log("parsed layers:", JSON.stringify(layers, null, 2));

  const editSource =
    decompose.images[0]?.url?.trim() || SAMPLE_IMAGE;

  printSection("Step 2 · 交互编辑 (size=2K, output_format=png)");
  const editPrompt = `把图 1 <bbox>${EDIT_BBOX.join(" ")}</bbox> 区域的物体改成红色`;
  console.log("prompt:", editPrompt);

  const edit = await volcengineImageGenerations({
    apiKey,
    model: MODEL,
    prompt: editPrompt,
    image: editSource,
    parameters: { size: "2K", output_format: "png" },
  });

  if (!edit.ok) {
    console.error("编辑失败:", edit.error);
    process.exit(1);
  }

  console.log("edit images:", edit.images.map((i) => i.url).filter(Boolean));
  console.log("\n改层更新策略（MVP）：策略 A — 编辑整图 OSS 后再 decompose");

  printSection("Done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
