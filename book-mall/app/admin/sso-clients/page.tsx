import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  createSsoClientAction,
  toggleSsoClientAction,
} from "@/app/actions/sso-client-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Platform SSO 客户端 — 管理后台" };

export default async function AdminSsoClientsPage() {
  const clients = await prisma.ssoClient.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/admin" className="text-primary underline">
            ← 管理后台
          </Link>
        </p>
        <h1 className="text-2xl font-bold">Platform SSO 客户端（Phase F）</h1>
        <p className="text-sm text-muted-foreground">
          第三方应用注册 <span className="font-mono">client_id</span> 与回调 URI；用户经{" "}
          <span className="font-mono">/api/sso/tools/re-enter?client_id=…&redirect_uri=…</span>{" "}
          换票。详见 <code className="text-xs">doc/tech/platform-api-v1.md</code>。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">注册新客户端</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSsoClientAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="clientId">client_id</Label>
                <Input id="clientId" name="clientId" placeholder="partner-demo" required />
              </div>
              <div>
                <Label htmlFor="name">名称</Label>
                <Input id="name" name="name" placeholder="合作方 Demo" required />
              </div>
            </div>
            <div>
              <Label htmlFor="redirectUris">redirect_uris（每行一条）</Label>
              <textarea
                id="redirectUris"
                name="redirectUris"
                className="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="http://localhost:3010/auth/callback"
                required
              />
            </div>
            <div>
              <Label htmlFor="allowedNavKeys">allowedNavKeys（可选，逗号分隔）</Label>
              <Input id="allowedNavKeys" name="allowedNavKeys" placeholder="fitting-room,text-to-image" />
            </div>
            <Button type="submit" size="sm">
              创建
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已注册客户端</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无客户端。</p>
          ) : (
            clients.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/60 p-4 text-sm">
                <p className="font-medium">
                  {c.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">({c.clientId})</span>
                </p>
                <ul className="mt-2 list-inside list-disc text-muted-foreground">
                  {c.redirectUris.map((u) => (
                    <li key={u} className="font-mono text-xs">
                      {u}
                    </li>
                  ))}
                </ul>
                <form action={toggleSsoClientAction} className="mt-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                  <Button type="submit" size="sm" variant="outline">
                    {c.active ? "停用" : "启用"}
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
