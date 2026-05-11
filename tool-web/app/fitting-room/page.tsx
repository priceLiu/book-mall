import Link from "next/link";
import { cookies } from "next/headers";

function mainOrigin(): string | null {
  const raw = process.env.MAIN_SITE_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return raw.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export default async function FittingRoomPage() {
  const jar = cookies();
  const token = jar.get("tools_token")?.value;
  const origin = mainOrigin();

  let introspect: Record<string, unknown> | null = null;
  let introspectStatus: number | null = null;
  if (token && origin) {
    const r = await fetch(`${origin}/api/sso/tools/introspect`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    introspectStatus = r.status;
    if (r.ok) introspect = (await r.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
  }

  const active = introspect?.active === true;

  return (
    <main>
      <h1>试衣间（占位）</h1>
      <p>
        独立工具应用的首页示例。后续可替换为真实 AI 试衣 UI；推理服务可再拆分为单独部署。
      </p>

      {!token ? (
        <p style={{ color: "#b45309" }}>
          未检测到 SSO 会话。请从主站个人中心点击「打开试衣间」，并确认本站的{" "}
          <code>MAIN_SITE_ORIGIN</code> 指向正在运行的主站。
          {origin ? (
            <>
              {" "}
              <Link href={`${origin}/account`}>打开主站个人中心</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {token && introspectStatus !== null ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem" }}>会话校验（主站 introspect）</h2>
          <pre
            style={{
              background: "#eee",
              padding: "1rem",
              overflow: "auto",
              fontSize: "0.8rem",
            }}
          >
            {JSON.stringify(introspect ?? { status: introspectStatus }, null, 2)}
          </pre>
          {active ? (
            <p style={{ color: "#15803d" }}>黄金会员状态有效，可在此扩展业务接口。</p>
          ) : (
            <p style={{ color: "#b91c1c" }}>
              令牌无效或已不再满足黄金会员条件，请返回主站充值后重试。
            </p>
          )}
        </section>
      ) : null}

      <p style={{ marginTop: "2rem" }}>
        <Link href="/">返回工具站首页</Link>
      </p>
    </main>
  );
}
