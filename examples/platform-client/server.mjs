import http from "node:http";
import { URL } from "node:url";

const secret = process.env.TOOLS_SSO_SERVER_SECRET?.trim() ?? "";
const bookOrigin = (process.env.BOOK_MALL_ORIGIN ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const clientId = process.env.CLIENT_ID?.trim() ?? "local-demo";
const redirectUri =
  process.env.REDIRECT_URI?.trim() ?? "http://localhost:3010/callback";
const port = Number(process.env.PORT ?? 3010);

const COOKIE = "platform_demo_token";

function readCookie(req, name) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function html(body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Platform Client Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code, pre { background: #f4f4f5; padding: 0.15rem 0.35rem; border-radius: 4px; }
    pre { padding: 1rem; overflow: auto; }
    a.button { display: inline-block; margin: 1rem 0; padding: 0.6rem 1rem; background: #111; color: #fff; text-decoration: none; border-radius: 6px; }
    .muted { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function reEnterUrl(redirectPath = "/") {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    redirect: redirectPath,
  });
  return `${bookOrigin}/api/sso/tools/re-enter?${q}`;
}

async function exchangeCode(code) {
  const res = await fetch(`${bookOrigin}/api/sso/tools/exchange`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `exchange ${res.status}`);
  }
  return data;
}

async function introspect(token) {
  const res = await fetch(`${bookOrigin}/api/sso/tools/introspect`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code")?.trim();
    const redirectPath = url.searchParams.get("redirect")?.trim() || "/";
    if (!code || secret.length < 16) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html("<h1>回调失败</h1><p>缺少 code 或未配置 TOOLS_SSO_SERVER_SECRET。</p>"));
      return;
    }
    try {
      const data = await exchangeCode(code);
      const token = data.access_token;
      const maxAge = typeof data.expires_in === "number" ? data.expires_in : 600;
      res.writeHead(302, {
        Location: redirectPath.startsWith("/") ? redirectPath : "/",
        "Set-Cookie": `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`,
      });
      res.end();
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html(`<h1>换票失败</h1><pre>${String(e.message ?? e)}</pre>`));
    }
    return;
  }

  if (url.pathname === "/api/me") {
    const token = readCookie(req, COOKIE);
    if (!token) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "no_token" }));
      return;
    }
    const result = await introspect(token);
    res.writeHead(result.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body, null, 2));
    return;
  }

  if (url.pathname === "/logout") {
    res.writeHead(302, {
      Location: "/",
      "Set-Cookie": `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`,
    });
    res.end();
    return;
  }

  const token = readCookie(req, COOKIE);
  let sessionBlock = `<p class="muted">尚未连接 Book 账号。</p>
    <a class="button" href="${reEnterUrl("/")}">使用 Book SSO 登录</a>`;

  if (token) {
    const { status, body } = await introspect(token);
    if (status === 200 && body?.active) {
      sessionBlock = `<p>已连接：<strong>${body.name ?? body.email ?? body.sub}</strong></p>
        <p><code>tools_nav_keys</code>：${(body.tools_nav_keys ?? []).join(", ") || "—"}</p>
        <pre>${JSON.stringify(body, null, 2)}</pre>
        <p><a href="/logout">退出</a></p>`;
    } else {
      sessionBlock = `<p>令牌无效或已过期。</p>
        <a class="button" href="${reEnterUrl("/")}">重新连接</a>`;
    }
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html(`
    <h1>Platform Client 示例</h1>
    <p class="muted">Phase F 第三方接入最小演示（client_id: <code>${clientId}</code>）</p>
    ${sessionBlock}
    <hr />
    <p class="muted">前置：Book 管理后台注册 redirect_uri <code>${redirectUri}</code>；复制 <code>TOOLS_SSO_SERVER_SECRET</code> 到 <code>.env.local</code>。</p>
  `));
});

server.listen(port, () => {
  console.log(`Platform client demo: http://localhost:${port}`);
  if (secret.length < 16) {
    console.warn("警告: TOOLS_SSO_SERVER_SECRET 未配置或过短");
  }
});
