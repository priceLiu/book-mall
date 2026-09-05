/**
 * 用量对账 · 常驻每日扫描（不依赖人工打开 /admin/usage-management）。
 *
 * 每个 CST 业务日切换后（且 CST 时刻 ≥ 01:00，等昨日任务收口），
 * 对「昨日」跑 平台业务表 vs Gateway 日志 审计：
 *   - 任一应用 MISSING_GATEWAY / ORPHAN_GATEWAY → PlatformErrorLog（USAGE_RECON_MISMATCH）
 *
 * 厂商 CSV 对账在上传时即时告警（见 usage-management route 的 reportVendorReconAlerts）。
 *
 * 开关与间隔：PlatformConfig（/admin/settings）> env > 默认。
 * env：USAGE_RECON_RESIDENT=0/false 关；USAGE_RECON_INTERVAL_MS 覆盖间隔（默认 30min）。
 * 每次 tick 前读 DB（30s 缓存），后台改配置无需重启。
 */
import { cstBusinessDate } from "@/lib/billing/cst-business-date";
import { recordPlatformError } from "@/lib/platform-error-log";
import type {
  UsageAuditAppRow,
  UsageAuditSnapshot,
} from "@/lib/admin/platform-cockpit-usage-audit";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

export { DEFAULT_INTERVAL_MS as DEFAULT_USAGE_RECON_INTERVAL_MS };
/** CST 01:00 后才对昨日出数（给昨日在飞任务 finalize 留窗口） */
const MIN_CST_HOUR = 1;

function residentEnabled(): boolean {
  const v = process.env.USAGE_RECON_RESIDENT?.trim().toLowerCase();
  return !(v === "0" || v === "false");
}

/** 是否应在本次 tick 运行：CST 已跨入新的一天且过了 MIN_CST_HOUR */
export function shouldRunUsageReconTick(
  now: Date,
  lastRunDateCst: string | null,
): { run: boolean; auditDate: string; todayCst: string } {
  const cst = new Date(now.getTime() + 8 * 3600_000);
  const todayCst = cstBusinessDate(now);
  const hour = cst.getUTCHours();
  const auditDate = cstBusinessDate(new Date(now.getTime() - 24 * 3600_000));
  if (hour < MIN_CST_HOUR) return { run: false, auditDate, todayCst };
  if (lastRunDateCst === todayCst) return { run: false, auditDate, todayCst };
  return { run: true, auditDate, todayCst };
}

/** 审计快照中的异常行（须告警） */
export function pickUsageReconAlertRows(
  snapshot: UsageAuditSnapshot,
): UsageAuditAppRow[] {
  return snapshot.rows.filter(
    (r) => r.status === "MISSING_GATEWAY" || r.status === "ORPHAN_GATEWAY",
  );
}

export async function runUsageReconForDate(auditDate: string): Promise<{
  auditDate: string;
  alertRows: UsageAuditAppRow[];
}> {
  const { buildUsageAuditForPeriod } = await import(
    "@/lib/admin/platform-cockpit-usage-audit"
  );
  const snapshot = await buildUsageAuditForPeriod({
    from: auditDate,
    to: auditDate,
  });
  const alertRows = pickUsageReconAlertRows(snapshot);

  if (alertRows.length > 0) {
    recordPlatformError({
      source: "SYSTEM",
      severity: "WARN",
      code: "USAGE_RECON_MISMATCH",
      message: `用量审计差异（${auditDate}）：${alertRows.length} 个应用 平台记录 vs Gateway 不一致`,
      detail: JSON.stringify(
        alertRows.map((r) => ({
          app: r.appKey,
          status: r.status,
          platform: r.platformCount,
          gateway: r.gatewayCount,
          auditSource: r.auditSource,
        })),
        null,
        2,
      ),
      context: { auditDate },
    });
  }

  return { auditDate, alertRows };
}

const GLOBAL_KEY = "__usageReconResidentState__";

type GlobalWithState = typeof globalThis & {
  [GLOBAL_KEY]?: { timer: NodeJS.Timeout | null; lastRunDateCst: string | null };
};

export function startResidentUsageReconScanner(): void {
  if (!residentEnabled()) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const g = globalThis as GlobalWithState;
  if (g[GLOBAL_KEY]?.timer) return;
  g[GLOBAL_KEY] = { timer: null, lastRunDateCst: null };

  const intervalMs = Number(process.env.USAGE_RECON_INTERVAL_MS) > 0
    ? Number(process.env.USAGE_RECON_INTERVAL_MS)
    : DEFAULT_INTERVAL_MS;

  const tick = () => {
    void (async () => {
      try {
        const { resolveUsageReconPolicyAsync } = await import(
          "@/lib/admin/logging-fuse-config-service"
        );
        const policy = await resolveUsageReconPolicyAsync();
        if (!policy.enabled) return;

        const state = g[GLOBAL_KEY]!;
        const decision = shouldRunUsageReconTick(new Date(), state.lastRunDateCst);
        if (!decision.run) return;
        const r = await runUsageReconForDate(decision.auditDate);
        state.lastRunDateCst = decision.todayCst;
        console.info(
          "[usage-recon] daily audit done",
          JSON.stringify({ auditDate: r.auditDate, alerts: r.alertRows.length }),
        );
      } catch (e) {
        console.warn(
          "[usage-recon] tick failed",
          e instanceof Error ? e.message : String(e),
        );
      }
    })();
  };

  const timer = setInterval(tick, Math.min(60_000, intervalMs));
  if (typeof timer.unref === "function") timer.unref();
  g[GLOBAL_KEY]!.timer = timer;

  console.info(
    "[usage-recon] resident scanner started",
    JSON.stringify({ intervalMs }),
  );

  setTimeout(tick, Math.min(60_000, intervalMs)).unref?.();
}
