/**
 * 从本地 apiclient_key.pem 生成 CloudBase 环境变量片段（不入 Git）。
 *
 * 用法：
 *   cd book-mall && node scripts/wechat-pay-cloudbase-env.mjs
 *   cd book-mall && node scripts/wechat-pay-cloudbase-env.mjs /path/to/apiclient_key.pem
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../");
const defaultKey = path.join(__dirname, "../certs/apiclient_key.pem");
const keyPath = path.resolve(process.argv[2] ?? defaultKey);
const outFile = path.join(repoRoot, "deploy/tencent/wechat-pay-cloudbase.env.patch");

if (!fs.existsSync(keyPath)) {
  console.error(`\n未找到商户私钥: ${keyPath}`);
  console.error("请从微信商户平台下载 API 证书，将 apiclient_key.pem 放到 book-mall/certs/ 后重试。\n");
  process.exit(1);
}

const pem = fs.readFileSync(keyPath, "utf8").trim();
if (!pem.includes("BEGIN PRIVATE KEY")) {
  console.error("文件不是有效的 PEM 私钥（应包含 BEGIN PRIVATE KEY）");
  process.exit(1);
}

const b64 = Buffer.from(pem, "utf8").toString("base64");
const lines = [
  "# 复制到 CloudBase → book-mall 服务 → 环境变量（勿提交 Git）",
  "# 生成时间: " + new Date().toISOString(),
  "",
  "WECHAT_PAY_PRIVATE_KEY_B64=" + b64,
  "",
  "# 确认 NOTIFY_URL 完整为：",
  "WECHAT_PAY_NOTIFY_URL=https://book.ai-code8.com/api/payments/wechat/notify",
  "",
  "# 保存后：重新部署 book-mall 并重启服务",
  "# 启动日志应出现: WeChat Pay private key materialized",
  "",
];

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, lines.join("\n"), "utf8");

console.log("\n✓ 已写入（仅本地，已 gitignore）：");
console.log("  deploy/tencent/wechat-pay-cloudbase.env.patch\n");
console.log("下一步：");
console.log("  1. 打开上述文件，复制 WECHAT_PAY_PRIVATE_KEY_B64= 整行到 CloudBase book-mall 环境变量");
console.log("  2. 确认 WECHAT_PAY_NOTIFY_URL 为完整 URL（见文件内注释）");
console.log("  3. 推送代码并重新部署 book-mall，重启服务\n");
