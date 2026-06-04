"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

type GatewayLinkStatus = {
  linked: boolean;
  gatewayApiKeyId: string | null;
  keyPrefix: string | null;
  keyName: string | null;
  linkedAt: string | null;
  boundKinds: string[];
  revoked: boolean;
};

const GATEWAY_ORIGIN =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim() || "http://localhost:3005";

export function GatewayApiKeyForm() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GatewayLinkStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/account/gateway-api-key", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as GatewayLinkStatus | null;
      if (!res.ok || !data) {
        setError("无法加载 Gateway 关联状态");
        return;
      }
      setStatus(data);
    } catch {
      setError("网络错误，请刷新页面");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function linkKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("请输入 Gateway API Key");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/account/gateway-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "关联失败");
        return;
      }
      setApiKey("");
      setSuccess("Gateway API Key 已关联，Canvas / Story / 工具站将经 Gateway 代理调用 AI。");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function unlinkKey() {
    if (
      !window.confirm(
        "确定解除与 Gateway API Key 的关联？Canvas / Story / 工具站将无法生成，直至重新关联。",
      )
    ) {
      return;
    }
    setUnlinking(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/account/gateway-api-key", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === "string" ? data.error : "解除失败");
        return;
      }
      setSuccess("已解除关联");
      await reload();
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        加载中…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="subscription" asChild>
          <a
            href={`/api/sso/gateway/issue?redirect=${encodeURIComponent("/dashboard/credentials")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
          >
            用 Book 账号打开 Gateway
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a
            href={`${GATEWAY_ORIGIN}/guide`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
          >
            用户需知
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        首次使用：先点上方按钮登录 Gateway → 绑定厂商凭证 → 创建 sk-gw → 回到本页粘贴关联。
        也可在 Gateway 登录页点「使用 Book 账号登录」（需已登录 Book）。
      </p>

      <p className="text-sm text-muted-foreground leading-relaxed">
        请先在{" "}
        <a
          href={`${GATEWAY_ORIGIN}/dashboard/credentials`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline"
        >
          Gateway 控制台
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>{" "}
        绑定 KIE / 百炼 / DeepSeek 厂商凭证，并创建{" "}
        <code className="text-xs">sk-gw-...</code> API Key，再粘贴到下方。Canvas、Story
        创作幻想家、AI 试衣、文生图、视频实验室、视觉分析室等均共用此关联。
        全部经 Gateway 代理，不在 Book 保存厂商 Key。{" "}
        <a
          href={`${GATEWAY_ORIGIN}/guide`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline"
        >
          用户需知与用量说明
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </p>

      {status?.linked ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            已关联 Gateway API Key
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {status.keyName ? `${status.keyName} · ` : ""}
            {status.keyPrefix}
          </p>
          {status.boundKinds.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              已绑定厂商：{status.boundKinds.join("、")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            用量与请求明细请在{" "}
            <a
              href={`${GATEWAY_ORIGIN}/dashboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-0.5"
            >
              Gateway 用量
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            、
            <a
              href={`${GATEWAY_ORIGIN}/dashboard/logs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              请求日志
            </a>
            查看。
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={unlinking}
            onClick={() => void unlinkKey()}
          >
            {unlinking ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Unlink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            解除关联
          </Button>
        </div>
      ) : status?.revoked ? (
        <p className="text-sm text-amber-700 dark:text-amber-500">
          此前关联的 Gateway Key 已吊销，请重新创建并关联。
        </p>
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-500">
          尚未关联 Gateway API Key，Canvas / Story / 工具站无法使用 AI 生成。
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="gateway-api-key">
          {status?.linked ? "更换 Gateway API Key" : "Gateway API Key（sk-gw-...）"}
        </Label>
        <PasswordInput
          id="gateway-api-key"
          autoComplete="off"
          placeholder="sk-gw-..."
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setError(null);
          }}
        />
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {success ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-500">{success}</p>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="subscription"
        disabled={saving || !apiKey.trim()}
        onClick={() => void linkKey()}
      >
        {saving ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : null}
        {status?.linked ? "更换并关联" : "验证并关联"}
      </Button>
    </div>
  );
}
