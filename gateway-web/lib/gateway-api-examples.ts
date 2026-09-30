/**
 * Gateway 对外 API · 模型调用示例（curl / fetch 共用）。
 * 用户用 sk-gw 调 :3005/api/v1，由 book-mall /api/gw/v1 转发厂商。
 */

export type GatewayApiExampleKind = "chat" | "createTask";

export type GatewayApiExample = {
  id: string;
  title: string;
  modelKey: string;
  role: "IMAGE" | "VIDEO" | "CHAT";
  providerKind: "KIE" | "VOLCENGINE" | "DASHSCOPE" | "BAILIAN";
  credentialLabel: string;
  kind: GatewayApiExampleKind;
  summary: string;
  body: Record<string, unknown>;
  notes: string[];
};

export const GATEWAY_API_EXAMPLES: GatewayApiExample[] = [
  {
    id: "gpt-image-2",
    title: "GPT Image 2.0",
    modelKey: "gpt-image-2-text-to-image",
    role: "IMAGE",
    providerKind: "KIE",
    credentialLabel: "KIE",
    kind: "createTask",
    summary: "文生图。KIE 上游须用 gpt-image-2-text-to-image；图生图改为 gpt-image-2-image-to-image 并加 input_urls。",
    body: {
      model: "gpt-image-2-text-to-image",
      gatewayModelKey: "gpt-image-2",
      input: {
        prompt: "Minimalist product poster, studio lighting, soft shadows",
        aspect_ratio: "1:1",
        resolution: "2K",
      },
    },
    notes: [
      "sk-gw 须绑定 KIE 凭证。",
      "图生图：model 改为 gpt-image-2-image-to-image，input.input_urls 传公网图 URL 数组。",
    ],
  },
  {
    id: "seedance-2",
    title: "Seedance 2.0",
    modelKey: "doubao-seedance-2.0",
    role: "VIDEO",
    providerKind: "VOLCENGINE",
    credentialLabel: "火山方舟 VOLCENGINE",
    kind: "createTask",
    summary: "火山方舟文生 / 图生视频。createTask 的 input 即方舟 contents/generations/tasks 体。",
    body: {
      model: "doubao-seedance-2.0",
      input: {
        content: [{ type: "text", text: "一只橘猫在阳光下的木地板上慢慢走过，电影感，浅景深" }],
        resolution: "720p",
        ratio: "16:9",
        duration: 5,
        watermark: false,
        generate_audio: false,
      },
    },
    notes: [
      "sk-gw 须绑定 VOLCENGINE 凭证。",
      "图生视频：在 content 追加 { type: \"image_url\", image_url: { url: \"https://...\" }, role: \"first_frame\" }。",
      "KIE 通道请改用 model: \"bytedance/seedance-2\"，input 用 prompt / reference_image_urls / aspect_ratio。",
    ],
  },
  {
    id: "wan-3",
    title: "Wan 3.0",
    modelKey: "wan3.0-video",
    role: "VIDEO",
    providerKind: "DASHSCOPE",
    credentialLabel: "DashScope / 百炼",
    kind: "createTask",
    summary: "通义万相 3.0 文生视频。走 dashscope.jobKind=video，videoBody 为厂商 input + parameters。",
    body: {
      model: "wan3.0-video",
      dashscope: {
        jobKind: "video",
        videoBody: {
          input: { prompt: "海边悬崖，黄昏金色光线，镜头缓慢前推，电影宽银幕" },
          parameters: {
            resolution: "720P",
            ratio: "16:9",
            duration: 5,
            watermark: false,
            prompt_extend: true,
          },
        },
      },
    },
    notes: [
      "sk-gw 须绑定 DASHSCOPE 或百炼凭证。",
      "图生 / 参考生：在 videoBody.input.media 放 { type: \"first_frame\" | \"reference_image\", url }。",
      "优速版把 model 换成 wan3.0-video-prime。",
    ],
  },
  {
    id: "qwen-3",
    title: "Qwen 3.0",
    modelKey: "qwen3.8-max",
    role: "CHAT",
    providerKind: "BAILIAN",
    credentialLabel: "百炼 BAILIAN",
    kind: "chat",
    summary: "千问 3.x 对话（现网旗舰 qwen3.8-max）。OpenAI 兼容 /chat/completions。",
    body: {
      model: "qwen3.8-max",
      messages: [{ role: "user", content: "用两句话介绍一下你自己。" }],
    },
    notes: [
      "sk-gw 须绑定百炼 / DashScope 凭证。",
      "同族还可试 qwen3.5-plus、qwen3.7-plus。",
      "千问出图请用 qwen-image-3.0-pro，走 createTask + dashscope.jobKind=multimodal-image-sync。",
    ],
  },
];

export function gatewayExamplePath(example: GatewayApiExample): string {
  return example.kind === "chat" ? "/chat/completions" : "/jobs/createTask";
}

export function buildGatewayExampleCurl(
  apiBase: string,
  example: GatewayApiExample,
  apiKey = "sk-gw-你的密钥",
): string {
  const url = `${apiBase.replace(/\/$/, "")}${gatewayExamplePath(example)}`;
  return `curl -X POST '${url}' \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(example.body, null, 2)}'`;
}

export function buildGatewayExampleFetch(
  apiBase: string,
  example: GatewayApiExample,
): string {
  const url = `${apiBase.replace(/\/$/, "")}${gatewayExamplePath(example)}`;
  return `const res = await fetch("${url}", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk-gw-你的密钥",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${JSON.stringify(example.body, null, 2)}),
});
const json = await res.json();`;
}

export function buildRecordInfoCurl(apiBase: string, apiKey = "sk-gw-你的密钥"): string {
  const base = apiBase.replace(/\/$/, "");
  return `curl -G '${base}/jobs/recordInfo' \\
  -H 'Authorization: Bearer ${apiKey}' \\
  --data-urlencode 'taskId=上一步返回的 taskId'`;
}
