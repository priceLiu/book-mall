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
  GATEWAY_CONSOLE: "控制台调试",
  EXTERNAL: "外部 API",
};

/** 日志表 Source 列 · 短标签 */
const CLIENT_SOURCE_SHORT: Record<string, string> = {
  CANVAS: "画布",
  STORY: "漫剧",
  TOOL: "工具站",
  GATEWAY_CONSOLE: "控制台",
  EXTERNAL: "外部 API",
};

const PROVIDER_LABEL: Record<string, string> = {
  KIE: "KIE",
  BAILIAN: "百炼",
  DEEPSEEK: "DeepSeek",
  DASHSCOPE: "DashScope",
  HUNYUAN: "混元 3D",
};

/** 日志页厂商筛选 · 展示顺序 */
export const LOG_PROVIDER_KIND_ORDER = [
  "KIE",
  "BAILIAN",
  "DEEPSEEK",
  "DASHSCOPE",
  "HUNYUAN",
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

/** 从当前日志批次提取 modelKey（可按厂商收窄） */
export function collectLogModels(
  logs: { model: string; providerKind: string | null }[],
  providerKind?: string,
): string[] {
  const models = new Set<string>();
  for (const l of logs) {
    if (providerKind && l.providerKind !== providerKind) continue;
    if (l.model?.trim()) models.add(l.model);
  }
  return [...models].sort((a, b) => a.localeCompare(b));
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
