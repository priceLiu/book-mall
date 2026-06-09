"use client";

import { useState, useTransition } from "react";
import type { PlatformCredentialPoolStatus } from "@/lib/gateway/platform-credential-pool";
import { Button } from "@/components/ui/button";
import {
  rebindManagedKeysAction,
  syncPlatformPoolFromEnvAction,
} from "./actions";

const SOURCE_LABEL: Record<PlatformCredentialPoolStatus["source"], string> = {
  env_ids: "环境变量 PLATFORM_VENDOR_CREDENTIAL_IDS",
  env_key: "环境变量 PLATFORM_GATEWAY_API_KEY_ID",
  db_platform_admin: "数据库 Platform Admin Key",
  empty: "未配置",
};

export function PlatformGatewayAdminClient({
  initialStatus,
  gatewaySsoCredentialsUrl,
  gatewaySsoKeysUrl,
}: {
  initialStatus: PlatformCredentialPoolStatus;
  gatewaySsoCredentialsUrl: string;
  gatewaySsoKeysUrl: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runSync() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const r = await syncPlatformPoolFromEnvAction();
      if (r.ok) {
        setMessage(
          `已从 env 同步 ${r.result.credentialCount} 条凭证到 canonical（${r.result.platformAdminKeyId.slice(0, 8)}…）`,
        );
        window.location.reload();
      } else {
        setError(r.error);
      }
    });
  }

  function runRebind() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const r = await rebindManagedKeysAction();
      if (r.ok) {
        setMessage(`已刷新 ${r.updated} 个平台托管 sk-gw 的凭证绑定`);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">凭证池来源</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">平台代付实际使用（canonical）</dt>
            <dd className="font-mono text-xs">{status.canonicalOwnerEmail}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">当前来源</dt>
            <dd>{SOURCE_LABEL[status.source]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Platform Admin Key</dt>
            <dd className="font-mono text-xs">{status.platformKeyId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Gateway 账号（canonical）</dt>
            <dd>{status.gatewayOwnerEmail ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">平台托管 sk-gw 数量</dt>
            <dd>{status.managedKeyCount}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Book 管理员</dt>
            <dd className="mt-1 text-muted-foreground">
              任意 ADMIN / FINANCE 可在此页查看与 env 同步；在 Gateway 登录{" "}
              <span className="font-mono text-xs">admin@126.com</span> 等管理员账号即可代管 canonical
              厂商 Key（无需切换 {status.canonicalOwnerEmail}）
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">canonical 已绑定厂商凭证（{status.credentials.length}）</h2>
        {status.credentials.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            凭证池为空。平台代付（无 Key）用户将无法调用 AI。请先在 Gateway 添加厂商 Key，或点击下方「从 env 同步」。
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">别名</th>
                <th className="py-2">厂商</th>
                <th className="py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {status.credentials.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2">{c.alias}</td>
                  <td className="py-2 font-mono text-xs">{c.providerKind}</td>
                  <td className="py-2">{c.active ? "启用" : "停用"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">管理操作</h2>
        <p className="text-sm text-muted-foreground">
          平台代付用户的隐藏 sk-gw 自动绑定 <strong>{status.canonicalOwnerEmail}</strong> 名下 Platform Admin Key 的凭证。
          在 Gateway 修改已有厂商 Key 后<strong>无需手动刷新</strong>；新增/移除厂商并绑到 Platform Admin Key 后，用户下次 AI 调用会自动对齐。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={runSync}>
            从 .env 导入到 canonical
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={runRebind}>
            立即全量对齐托管 sk-gw（通常不必）
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={gatewaySsoCredentialsUrl} target="_blank" rel="noopener noreferrer">
              Gateway · 厂商凭证
            </a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={gatewaySsoKeysUrl} target="_blank" rel="noopener noreferrer">
              Gateway · Platform Admin Key
            </a>
          </Button>
        </div>
        {message ? <p className="text-sm text-green-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">推荐流程</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            使用 <strong>{status.canonicalOwnerEmail}</strong> 或 Book 管理员 Gateway 账号（如 admin@126.com）→
            模型管理
          </li>
          <li>修改已有 Key 的值：保存后即生效（平台代付用户下次调用自动使用）</li>
          <li>新增厂商：创建凭证后会自动绑到 Platform Admin Key</li>
          <li>
            Book 管理后台 <code className="text-xs">/admin/gateway/platform</code> 可查看状态、从 env 导入
          </li>
        </ol>
        <p className="mt-2">
          也可在 <code className="text-xs">.env.local</code> 设置{" "}
          <code className="text-xs">PLATFORM_GATEWAY_API_KEY_ID=&lt;Platform Admin Key ID&gt;</code>
        </p>
      </section>
    </div>
  );
}
