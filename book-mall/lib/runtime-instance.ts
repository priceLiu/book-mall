/**
 * 运行时实例指纹：区分「是哪个实例在打这条日志」。
 * 多容器 / 新旧版本并存时，凭 hostname + commitSha 定位来源进程。
 * 仅服务端使用（依赖 node:os / process）。
 */
import { hostname } from "node:os";

export type RuntimeInstanceInfo = {
  /** 容器 / 主机名（CloudBase 实例通常为容器 hostname） */
  host: string;
  pid: number;
  nodeEnv: string;
  /** 部署版本（VERCEL_GIT_COMMIT_SHA / GIT_SHA / SOURCE_COMMIT 任一） */
  commitSha: string;
  /** 运维自定义实例标签（APP_INSTANCE_LABEL，如 "tencent-book-mall-prod"） */
  instanceLabel: string;
};

let cached: RuntimeInstanceInfo | null = null;

export function getRuntimeInstanceInfo(): RuntimeInstanceInfo {
  if (cached) return cached;
  cached = {
    host: hostname(),
    pid: process.pid,
    nodeEnv: process.env.NODE_ENV ?? "",
    commitSha: (
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GIT_SHA ??
      process.env.SOURCE_COMMIT ??
      ""
    ).slice(0, 12),
    instanceLabel: process.env.APP_INSTANCE_LABEL?.trim() ?? "",
  };
  return cached;
}

/** 写入 PlatformErrorLog.context.runtime 的紧凑形态 */
export function runtimeInstanceContext(): Record<string, string | number> {
  const i = getRuntimeInstanceInfo();
  const out: Record<string, string | number> = { host: i.host, pid: i.pid };
  if (i.nodeEnv) out.nodeEnv = i.nodeEnv;
  if (i.commitSha) out.commitSha = i.commitSha;
  if (i.instanceLabel) out.instanceLabel = i.instanceLabel;
  return out;
}

/** 测试用：清缓存 */
export function resetRuntimeInstanceCacheForTest(): void {
  cached = null;
}
