"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
type Props = {
  resolvedOrigin: string | null;
  rawToolsPublicOrigin: string;
  /** 可选：覆盖签发用工具站 origin（见 TOOLS_SSO_ISSUE_ORIGIN） */
  rawIssueOrigin: string;
  nextAuthUrl: string;
  ssoReady: boolean;
  ssoIssues: string[];
};

export function ToolsSsoTestClient({
  resolvedOrigin,
  rawToolsPublicOrigin,
  rawIssueOrigin,
  nextAuthUrl,
  ssoReady,
  ssoIssues,
}: Props) {
  const [redirectPath, setRedirectPath] = useState("/fitting-room");
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function issueRedirect(): Promise<string | null> {
    setErr(null);
    setLastUrl(null);
    const res = await fetch("/api/sso/tools/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ redirectPath: redirectPath.trim() || "/fitting-room" }),
    });
    const rawText = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      /* */
    }
    if (!res.ok) {
      const msg =
        typeof data.error === "string"
          ? data.error
          : rawText.trim().slice(0, 300) || `HTTP ${res.status}`;
      setErr(msg);
      return null;
    }
    const url = typeof data.redirectUrl === "string" ? data.redirectUrl : null;
    if (!url) {
      setErr("响应中无 redirectUrl");
      return null;
    }
    setLastUrl(url);
    return url;
  }

  async function handleInspect() {
    if (busy) return;
    setBusy(true);
    try {
      await issueRedirect();
    } finally {
      setBusy(false);
    }
  }

  async function handleDirectJump() {
    if (busy) return;
    setBusy(true);
    try {
      const url = await issueRedirect();
      if (url) window.location.assign(url);
    } finally {
      setBusy(false);
    }
  }

  function handleToolsOpenJump() {
    const p = redirectPath.trim() || "/fitting-room";
    const href = `/tools-open?redirect=${encodeURIComponent(p)}`;
    window.location.assign(href);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const usingBookHeuristic =
    !!resolvedOrigin &&
    !!rawToolsPublicOrigin &&
    !rawIssueOrigin &&
    (() => {
      try {
        const rawHost = new URL(rawToolsPublicOrigin).hostname;
        return (
          rawHost.endsWith(".sh.run.tcloudbase.com") &&
          new URL(resolvedOrigin).origin !== new URL(rawToolsPublicOrigin).origin
        );
      } catch {
        return false;
      }
    })();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">工具站跳转测试</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          仅供管理员验证 SSO 签发地址是否与线上一致（与「个人中心 → 打开工具站」同源 API）。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">当前解析结果（服务端）</CardTitle>
          <CardDescription>
            <code className="text-xs">getToolsPublicOrigin()</code> 用于拼{" "}
            <code className="text-xs">/auth/sso/callback</code> 链接。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">签发使用的 Origin</span>
            <p className="mt-0.5 break-all font-mono text-xs">
              {resolvedOrigin ?? (
                <span className="text-destructive">（无法解析，请检查 TOOLS_PUBLIC_ORIGIN）</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">环境变量 TOOLS_PUBLIC_ORIGIN（原始）</span>
            <p className="mt-0.5 break-all font-mono text-xs">
              {rawToolsPublicOrigin || "（未设置）"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">
              TOOLS_SSO_ISSUE_ORIGIN（可选，覆盖签发用 Origin）
            </span>
            <p className="mt-0.5 break-all font-mono text-xs">
              {rawIssueOrigin || "（未设置）"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">NEXTAUTH_URL</span>
            <p className="mt-0.5 break-all font-mono text-xs">
              {nextAuthUrl || "（未设置）"}
            </p>
          </div>
          {rawIssueOrigin ? (
            <p className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100">
              已启用 TOOLS_SSO_ISSUE_ORIGIN：签发跳转优先使用该值（典型：
              https://tool.ai-code8.com）。工具站进程内 TOOLS_PUBLIC_ORIGIN 仍须与用户地址栏一致。
            </p>
          ) : null}
          {usingBookHeuristic ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              检测到 TOOLS_PUBLIC_ORIGIN 仍为云托管默认域，且 NEXTAUTH_URL 为自定义 book.*，
              已按 book.* → tool.* 推导签发地址；若当前 NEXTAUTH 仍是 *.sh.run，请改控制台或使用
              TOOLS_SSO_ISSUE_ORIGIN。
            </p>
          ) : null}
          {!ssoReady ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <p className="font-medium">SSO 配置未就绪</p>
              <ul className="mt-1 list-inside list-disc">
                {ssoIssues.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">试跳转</CardTitle>
          <CardDescription>
            登录态须为管理员（或满足黄金会员条件；本页在管理后台内一般为管理员）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tools-test-redirect">工具站内路径 redirect</Label>
            <Input
              id="tools-test-redirect"
              value={redirectPath}
              onChange={(e) => setRedirectPath(e.target.value)}
              placeholder="/fitting-room"
              className="font-mono text-sm"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleInspect()}>
              仅签发并显示 URL
            </Button>
            <Button type="button" variant="default" disabled={busy} onClick={() => void handleDirectJump()}>
              直达 callback（browser 整页跳转）
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={handleToolsOpenJump}>
              经 tools-open（与前台按钮一致）
            </Button>
          </div>

          {err ? (
            <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
          ) : null}
          {lastUrl ? (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="text-muted-foreground">最近一次 redirectUrl</p>
              <p className="mt-1 break-all font-mono">{lastUrl}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2"
                onClick={() => void copyText(lastUrl)}
              >
                复制链接
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
