/** 个人中心 · 新标签打开子应用（经 *-open 过渡页） */

export async function openToolsAppInNewTab(
  redirectPath = "/fitting-room",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  try {
    const res = await fetch("/api/sso/tools/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ redirectPath: path }),
    });
    const raw = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* non-JSON */
    }
    if (!res.ok) {
      const err =
        typeof data.error === "string"
          ? data.error
          : `请求失败（HTTP ${res.status}）`;
      return { ok: false, message: err };
    }
    const href = `/tools-open?redirect=${encodeURIComponent(path)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export function openCanvasAppInNewTab(redirectPath = "/projects") {
  const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  const href = `/canvas-open?path=${encodeURIComponent(path)}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

export function openEcomAppInNewTab(redirectPath = "/") {
  const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  const href = `/ecom-open?path=${encodeURIComponent(path)}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

export function openQuickReplicaAppInNewTab(redirectPath = "/") {
  const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  const href = `/quick-replica-open?path=${encodeURIComponent(path)}`;
  window.open(href, "_blank", "noopener,noreferrer");
}
