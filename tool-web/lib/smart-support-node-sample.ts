/** 实现逻辑页展示：经 Book SSO Gateway BFF 的多轮对话（非流式）。 */
export const SMART_SUPPORT_MULTI_ROUND_NODE_SAMPLE = `// 多轮对话（Node.js · 经 Gateway BFF，勿直连厂商 Key）
// DeepSeek 为无状态 API：每次请求需携带完整 history（含助手上一轮正文）。

const res1 = await fetch("/api/smart-support/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "世界上最高的山是什么？" }],
    model: "deepseek-v4-flash",
  }),
});

// Round 2：追加 assistant + 新 user 消息后再次 POST
const data1 = await res1.json();
const messages = [
  { role: "user", content: "世界上最高的山是什么？" },
  { role: "assistant", content: data1.text },
  { role: "user", content: "第二高的是哪座？" },
];
await fetch("/api/smart-support/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages, model: "deepseek-v4-flash" }),
});`;
