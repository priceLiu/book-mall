/** Gateway 请求日志 · 展示用文案（与 book-mall GatewayRequestLog 枚举对齐） */

export type LogClientSource =
  | "CANVAS"
  | "STORY"
  | "TOOL"
  | "GATEWAY_CONSOLE"
  | "EXTERNAL"
  | string;

/** 日志页 · 按工具应用筛选（value 空 = 全部） */
export const LOG_APP_FILTER_OPTIONS: {
  value: "" | LogClientSource;
  label: string;
}[] = [
  { value: "", label: "全部" },
  { value: "CANVAS", label: "画布" },
  { value: "TOOL", label: "工具站" },
  { value: "STORY", label: "漫剧" },
  { value: "E_COMMERCE", label: "电商工具箱" },
  { value: "GATEWAY_CONSOLE", label: "控制台" },
  { value: "EXTERNAL", label: "外部 API" },
];

export type LogProviderKind =
  | "KIE"
  | "BAILIAN"
  | "DEEPSEEK"
  | "DASHSCOPE"
  | "HUNYUAN"
  | string
  | null;

export type LogRequestStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | string;

const CLIENT_SOURCE_LABEL: Record<string, string> = {
  CANVAS: "Canvas 画布",
  STORY: "Story 漫剧",
  E_COMMERCE: "电商工具箱",
  GATEWAY_CONSOLE: "控制台调试",
  EXTERNAL: "外部 API",
};

/** 日志表 Source 列 · 短标签 */
const CLIENT_SOURCE_SHORT: Record<string, string> = {
  CANVAS: "画布",
  STORY: "漫剧",
  TOOL: "工具站",
  E_COMMERCE: "电商",
  GATEWAY_CONSOLE: "控制台",
  EXTERNAL: "外部 API",
};

const PROVIDER_LABEL: Record<string, string> = {
  KIE: "KIE",
  BAILIAN: "百炼",
  DEEPSEEK: "DeepSeek",
  DASHSCOPE: "DashScope",
  HUNYUAN: "混元 3D",
  VOLCENGINE: "火山",
};

/** 日志页厂商筛选 · 展示顺序 */
export const LOG_PROVIDER_KIND_ORDER = [
  "KIE",
  "BAILIAN",
  "DEEPSEEK",
  "DASHSCOPE",
  "HUNYUAN",
  "VOLCENGINE",
] as const;

export function sortLogProviderKinds(kinds: Iterable<string>): string[] {
  const list = [...new Set(kinds)].filter(Boolean);
  return list.sort((a, b) => {
    const ia = LOG_PROVIDER_KIND_ORDER.indexOf(
      a as (typeof LOG_PROVIDER_KIND_ORDER)[number],
    );
    const ib = LOG_PROVIDER_KIND_ORDER.indexOf(
      b as (typeof LOG_PROVIDER_KIND_ORDER)[number],
    );
    const ao = ia === -1 ? 999 : ia;
    const bo = ib === -1 ? 999 : ib;
    if (ao !== bo) return ao - bo;
    return a.localeCompare(b);
  });
}

/** 从当前日志批次提取厂商（去重、排序） */
export function collectLogProviderKinds(
  logs: { providerKind: string | null }[],
): string[] {
  return sortLogProviderKinds(
    logs.map((l) => l.providerKind).filter((k): k is string => !!k),
  );
}

/** 与财务明细 canonicalModelKey 对齐的展示名 */
export function displayLogModelKey(log: {
  model: string;
  canonicalModelKey?: string | null;
  displayModelKey?: string | null;
}): string {
  const display = log.displayModelKey?.trim();
  if (display) return display;
  const canonical = log.canonicalModelKey?.trim();
  return canonical || log.model;
}

/** 从当前日志批次提取 modelKey（可按厂商收窄） */
export function collectLogModels(
  logs: { model: string; canonicalModelKey?: string | null; providerKind: string | null }[],
  providerKind?: string,
): string[] {
  const models = new Set<string>();
  for (const l of logs) {
    if (providerKind && l.providerKind !== providerKind) continue;
    const key = displayLogModelKey(l);
    if (key.trim()) models.add(key);
  }
  return [...models].sort((a, b) => a.localeCompare(b));
}

/** 日志表 · 渠道 Key 脱敏（前 4 + ***** + 后 4） */
export function formatLogCredentialKeyMasked(raw: string | null | undefined): string {
  const value = raw?.trim();
  if (!value) return "—";
  const alreadyMasked = value.match(/^(.{4})\*+(.{4})$/);
  if (alreadyMasked) {
    return `${alreadyMasked[1]}*****${alreadyMasked[2]}`;
  }
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}*****${value.slice(-4)}`;
}

/** 日志表 · Log / Request / Vendor Task ID 列 */
export function formatLogMonospaceId(value: string | null | undefined): {
  value: string;
  title?: string;
} {
  const trimmed = value?.trim();
  if (!trimmed) return { value: "—" };
  return { value: trimmed, title: trimmed };
}

/** 日志表 · Canvas 节点 task / Story task 关联列 */
export function formatLogAppTaskCell(input: {
  appTaskId?: string | null;
  appTaskKind?: string | null;
  appTaskNodeId?: string | null;
}): { value: string; title?: string } {
  const taskId = input.appTaskId?.trim();
  if (!taskId) return { value: "—" };
  const kind =
    input.appTaskKind === "canvas"
      ? "Canvas 节点 task"
      : input.appTaskKind === "story"
        ? "Story task"
        : "应用 task";
  const nodeId = input.appTaskNodeId?.trim();
  const title = nodeId
    ? `${kind}\nTask: ${taskId}\nNode: ${nodeId}`
    : `${kind}\nTask: ${taskId}`;
  return { value: taskId, title };
}

const POLL_DELAY_LIMIT_MS = 10_000;
const POLL_INFLIGHT_WARN_MS = 120_000;

/** 日志表 · 火山视频耗时阶段（排队 / 生成 / 后处理 / 轮询延迟） */
export function formatLogTimingPhaseCell(
  ms: number | null | undefined,
  phase: "queue" | "generate" | "postproc" | "poll",
  opts?: {
    overLimit?: boolean;
    stallHint?: string | null;
    stallCause?: string | null;
    inProgress?: boolean;
  },
): { value: string; title?: string; warn?: boolean } {
  if (ms == null || ms < 0) return { value: "—" };
  const sec = Math.round(ms / 1000);
  const labels = {
    queue: "火山排队",
    generate: "厂商生成（进行中为墙钟；失败为等厂商终态）",
    postproc: "厂商后处理（仅成功任务；updated_at → succeeded）",
    poll: "我方轮询 / 收口延迟",
  } as const;
  let title = `${labels[phase]} · ${sec}s`;
  if (phase === "poll") {
    const inProgress = opts?.inProgress === true;
    const warn =
      opts?.overLimit === true ||
      (!inProgress && ms > POLL_DELAY_LIMIT_MS) ||
      (inProgress && ms > POLL_INFLIGHT_WARN_MS);
    if (warn) {
      title += inProgress
        ? "（进行中 >2min 未 poll，轮询可能停摆）"
        : "（超过 10s 上限，请检查 poll worker）";
    }
    if (opts?.stallCause) {
      title += `\n原因：${opts.stallCause}`;
    }
    if (opts?.stallHint?.trim()) {
      title += `\n${opts.stallHint.trim()}`;
    }
    return { value: `${sec}s`, title, warn };
  }
  return { value: `${sec}s`, title };
}

/** 从当前日志批次提取渠道 Key（可按厂商收窄） */
export function collectLogCredentialKeys(
  logs: { credentialKeyMasked: string | null; providerKind: string | null }[],
  providerKind?: string,
): string[] {
  const keys = new Set<string>();
  for (const l of logs) {
    if (providerKind && l.providerKind !== providerKind) continue;
    const masked = l.credentialKeyMasked?.trim();
    if (masked) keys.add(masked);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

/** 日志页厂商筛选 · 固定展示（含当前批次无记录的厂商） */
export function logProviderFilterOptions(
  kindsInBatch: Iterable<string>,
): string[] {
  const seen = new Set<string>(LOG_PROVIDER_KIND_ORDER);
  for (const k of kindsInBatch) {
    if (k) seen.add(k);
  }
  return sortLogProviderKinds(seen);
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "排队",
  RUNNING: "进行中",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const REQUEST_KIND_LABEL: Record<string, string> = {
  CHAT: "对话",
  IMAGE: "图像",
  VIDEO: "视频",
  OTHER: "其他",
};

export function formatClientSourceLabel(source: LogClientSource): string {
  return CLIENT_SOURCE_LABEL[source] ?? source;
}

export function formatClientSourceShortLabel(source: LogClientSource): string {
  return CLIENT_SOURCE_SHORT[source] ?? formatClientSourceLabel(source);
}

export function formatProviderKindLabel(kind: LogProviderKind): string {
  if (!kind) return "—";
  return PROVIDER_LABEL[kind] ?? kind;
}

/** 如「Canvas 画布 · KIE」「Canvas 画布 · 百炼」 */
export function formatLogOriginLabel(
  clientSource: LogClientSource,
  providerKind: LogProviderKind,
): string {
  const src = formatClientSourceLabel(clientSource);
  const vendor = formatProviderKindLabel(providerKind);
  if (vendor === "—") return src;
  return `${src} · ${vendor}`;
}

/** 日志表 Source 列 · 含页面 slug，如「工具站 · image-to-video」 */
export function formatLogPageLabel(
  clientSource: LogClientSource,
  clientPage?: string | null,
): string {
  const src = formatClientSourceShortLabel(clientSource);
  const page = clientPage?.trim();
  if (page) return `${src} · ${page}`;
  return src;
}

/** Source 列悬停 · 拼接页面与厂商 */
export function formatLogSourceTooltip(
  clientSource: LogClientSource,
  providerKind: LogProviderKind,
  clientPage?: string | null,
): string {
  const src = formatClientSourceLabel(clientSource);
  const page = clientPage?.trim();
  const vendor = formatProviderKindLabel(providerKind);
  const parts = [src];
  if (page) parts.push(page);
  if (vendor !== "—") parts.push(vendor);
  return parts.join(" · ");
}

export function formatRequestStatusLabel(status: LogRequestStatus): string {
  return STATUS_LABEL[status] ?? status;
}

/** 参考 KIE 控制台：running / success 等英文短标签（日志表 Status 列） */
export function formatRequestStatusShortLabel(status: LogRequestStatus): string {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "failed";
    case "RUNNING":
      return "running";
    case "PENDING":
      return "pending";
    case "CANCELLED":
      return "cancelled";
    default:
      return String(status).toLowerCase();
  }
}

export function statusDotClass(status: LogRequestStatus): string {
  switch (status) {
    case "SUCCEEDED":
      return "bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.65)]";
    case "FAILED":
      return "bg-[#ef4444] shadow-[0_0_6px_rgba(239,68,68,0.55)]";
    case "RUNNING":
      return "bg-[#f97316] shadow-[0_0_6px_rgba(249,115,22,0.65)]";
    case "PENDING":
      return "bg-[#eab308] shadow-[0_0_6px_rgba(234,179,8,0.55)]";
    case "CANCELLED":
      return "bg-zinc-500";
    default:
      return "bg-zinc-400";
  }
}

export function formatRequestKindLabel(kind: string): string {
  return REQUEST_KIND_LABEL[kind] ?? kind;
}

export function statusBadgeClass(status: LogRequestStatus): string {
  switch (status) {
    case "SUCCEEDED":
      return "bg-emerald-500/15 text-emerald-300";
    case "FAILED":
      return "bg-red-500/15 text-red-300";
    case "RUNNING":
      return "bg-sky-500/15 text-sky-300";
    case "PENDING":
      return "bg-amber-500/15 text-amber-300";
    case "CANCELLED":
      return "bg-zinc-500/15 text-zinc-400";
    default:
      return "bg-white/10 text-[var(--gw-muted)]";
  }
}
