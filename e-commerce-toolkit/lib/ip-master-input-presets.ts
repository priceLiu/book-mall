export type IpMasterInputMode = "1" | "2" | "3" | "4";

export const IP_MASTER_DEFAULT_INPUT_MODE: IpMasterInputMode = "3";

export const IP_MASTER_INPUT_MODE_OPTIONS: Array<{
  id: IpMasterInputMode;
  label: string;
  hint: string;
}> = [
  { id: "1", label: "模式 1 · 仅基准图", hint: "只上传基准图，文字框可留空" },
  { id: "2", label: "模式 2 · 仅文字", hint: "大白话描述即可，由 AI 出结构化模板" },
  { id: "3", label: "模式 3 · 图文（推荐）", hint: "基准图 + 大白话，文字优先于识图" },
  { id: "4", label: "模式 4 · 文生起图", hint: "大白话 → 审阅页确认提示词后生基准图" },
];

export const IP_MASTER_INPUT_MODE_TABLE_ROWS: Array<{
  mode: string;
  input: string;
  flow: string;
  scene: string;
  priority: string;
}> = [
  {
    mode: "模式 1",
    input: "只上传基准图，文字框空",
    flow: "AI 识图解析图片，提取锚点生成模板",
    scene: "已有手绘 / 定稿角色立绘",
    priority: "图片解析结果直接输出模板",
  },
  {
    mode: "模式 2",
    input: "只填 BRIEF 文字，不上传图",
    flow: "AI 直接整理文本，生成 IP 模板（不画图）",
    scene: "前期构思，还不需要视觉图，只想要角色规则文档",
    priority: "以用户文字为准",
  },
  {
    mode: "模式 3（推荐）",
    input: "上传基准图 + 填写 BRIEF 图文一起提交",
    flow: "图片做视觉参考，文字作为人工约束，合并生成模板",
    scene: "已有画稿，人工需要手动锁定核心锚点",
    priority: "文字 BRIEF > 图片解析",
  },
  {
    mode: "模式 4",
    input: "仅输入 BRIEF 文字（可先不上传图）",
    flow: "LLM 同时产出「生图提示词 + 结构化模板」→ 审阅页可改可局部重生成 → 确认后点「生成基准图」→ 再保存进母版库",
    scene: "从零创作全新 IP，文字起稿，不自动连链生图",
    priority: "原始 BRIEF 最高；基准图按你确认的生图提示词生成",
  },
];

export const IP_MASTER_BENCHMARK_POSITIVE_PROMPT = [
  "泡泡玛特潮玩Q版角色标准正面基准立绘，纯白#FFFFFF纯色背景，平视正面视角，中立标准站姿，角色波波仔。",
  "3头身比例，圆形包子脸，无尖锐下巴，一对半圆形厚边垂落大耳朵，宽眼距大圆眼睛，小巧鼻子，短粗圆柱四肢，圆滚滚躯体。",
  "身穿简约基础蓝色连体卫衣，基础款服饰（服饰属于可变项），无多余场景，无阴影，无特效，无复杂装饰，干净平面渲染，角色轮廓清晰完整，画面居中，只画单个角色，高清，角色结构完整，适合作为IP母版参考图。",
].join("");

export const IP_MASTER_BENCHMARK_NEGATIVE_PROMPT =
  "动态动作，侧脸，透视，场景，背景，阴影，渐变，复杂花纹，破碎，畸形五官，肢体残缺，多人物，水印，文字，logo，夸张变形，镜头畸变，手办底座，复杂道具，表情夸张";

export const IP_MASTER_DEFAULT_BRIEF = `IP名称：波波仔
风格定位：泡泡玛特潮玩Q版IP，可爱治愈，3D哑光树脂手办风格，同时适配2D表情包、品牌VI视觉。`;

export function parseIpMasterInputMode(raw: unknown): IpMasterInputMode {
  if (raw === "1" || raw === "2" || raw === "3" || raw === "4") return raw;
  return IP_MASTER_DEFAULT_INPUT_MODE;
}

export function normalizeIpMasterBrief(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function isIpMasterPlaceholderBrief(text: string): boolean {
  return !normalizeIpMasterBrief(text);
}

export function hasEffectiveIpMasterBrief(briefText: string): boolean {
  return !isIpMasterPlaceholderBrief(briefText);
}

export function buildIpMasterExtractUserMessage(mode: IpMasterInputMode): string {
  const priority =
    mode === "1"
      ? "优先级：以图片识图解析结果为准，文字 BRIEF 若为空则完全依赖图片。"
      : mode === "2"
        ? "优先级：以用户 BRIEF 文字为准，无基准图，不要编造未提供的视觉细节。"
        : mode === "3"
          ? "优先级：文字 BRIEF 高于图片解析；冲突时以 BRIEF 锁定刚性锚点。"
          : "优先级：原始 BRIEF 文字最高；基准图若为 AI 生成仅作视觉载体，刚性锚点以 BRIEF 为准。";

  return `当前为模式 ${mode}。${priority}

请根据当前基准图与 Brief，按 IP 母版 Skill 输出完整 Markdown 模板（可直接保存为版本）。`;
}

export function validateIpMasterInputForExtract(opts: {
  mode: IpMasterInputMode;
  hasBenchmark: boolean;
  briefText: string;
}): string | null {
  const hasBrief = hasEffectiveIpMasterBrief(opts.briefText);
  if (opts.mode === "1" && !opts.hasBenchmark) return "模式 1 须上传基准图";
  if (opts.mode === "2" && !hasBrief) return "模式 2 须填写大白话描述";
  if (opts.mode === "3") {
    if (!opts.hasBenchmark) return "模式 3 须上传基准图";
    if (!normalizeIpMasterBrief(opts.briefText)) return "模式 3 须填写 BRIEF";
  }
  if (opts.mode === "4" && !hasBrief) return "模式 4 须填写大白话描述";
  return null;
}

export function isIpMasterInputCommitted(project: {
  references: unknown[];
  chatHistory: Array<{ role: string }>;
  meta?: { workflow?: { inputCommitted?: boolean }; templateVersions?: unknown[] };
  brief?: { description?: unknown } | null;
}): boolean {
  if (project.meta?.workflow?.inputCommitted === true) return true;
  if (project.meta?.workflow?.inputCommitted === false) return false;
  const briefText =
    typeof project.brief?.description === "string" ? project.brief.description : "";
  return (
    project.references.length > 0 ||
    (project.meta?.templateVersions?.length ?? 0) > 0 ||
    project.chatHistory.some((m) => m.role === "user") ||
    hasEffectiveIpMasterBrief(briefText)
  );
}

export function ipMasterProjectHasWork(
  project: import("@/lib/ip-master-types").IpMasterProject,
  draftMarkdown: string,
): boolean {
  const briefText =
    typeof project.brief?.description === "string" ? project.brief.description : "";
  const history = project.chatHistory ?? [];
  const hasAssistantReply = history.some(
    (m) => m.role === "assistant" && m.id !== "welcome",
  );
  return (
    Boolean(project.references?.length) ||
    Boolean(draftMarkdown.trim()) ||
    Boolean(project.meta?.workflow?.draftTemplate) ||
    (project.meta?.templateVersions?.length ?? 0) > 0 ||
    history.some((m) => m.role === "user") ||
    hasAssistantReply ||
    hasEffectiveIpMasterBrief(briefText)
  );
}
