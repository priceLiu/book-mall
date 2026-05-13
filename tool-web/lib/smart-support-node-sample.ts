/** 实现逻辑页展示：由 doc/multi-rounded-chat.MD 中 Python 示例改写的 Node.js 多轮调用（非流式）。 */
export const SMART_SUPPORT_MULTI_ROUND_NODE_SAMPLE = `// 多轮对话（Node.js / OpenAI SDK）
// DeepSeek 为无状态 API：每次请求需携带完整 history（含助手上一轮正文）。
// 文档：doc/multi-rounded-chat.MD

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

// Round 1
let messages = [
  { role: "user", content: "世界上最高的山是什么？" },
];
const res1 = await client.chat.completions.create({
  model: "deepseek-chat",
  messages,
});
messages.push(res1.choices[0].message);

// Round 2：先追加助手回复，再追加新用户句
messages.push({ role: "user", content: "第二高的是哪座？" });
const res2 = await client.chat.completions.create({
  model: "deepseek-chat",
  messages,
});
messages.push(res2.choices[0].message);

// 流式版：create({ ..., stream: true }) 后用 for await 拼 assistant content`;
