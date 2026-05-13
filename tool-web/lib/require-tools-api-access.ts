import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchToolsSessionUncached } from "@/lib/tools-introspect";
import type { ToolSuiteNavKey } from "@/lib/tool-suite-nav-keys";

function introspectRecord(
  intro: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!intro || typeof intro !== "object") return null;
  return intro;
}

/** 任意有效工具站会话（不校验套件）；用于钱包等跨套件接口 */
export async function requireActiveToolsSession(): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const jar = cookies();
  const token = jar.get("tools_token")?.value;
  const sess = await fetchToolsSessionUncached(token);
  if (!sess.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "tools_session_inactive", message: "工具站会话无效或未登录" },
        { status: 401 },
      ),
    };
  }
  return { ok: true };
}

/**
 * 校验 Cookie 对应用户是否具备某工具套件 navKey（admin 直通）。
 * 依赖主站 introspect / 含 keys 的 JWT 快路径。
 */
export async function requireToolSuiteNavAccess(
  navKey: ToolSuiteNavKey,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const jar = cookies();
  const token = jar.get("tools_token")?.value;
  const sess = await fetchToolsSessionUncached(token);
  if (!sess.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "tools_session_inactive", message: "工具站会话无效或未登录" },
        { status: 401 },
      ),
    };
  }

  const intro = introspectRecord(sess.introspect as Record<string, unknown> | null);
  if (!intro) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "tools_introspect_missing", message: "无法读取会话载荷" },
        { status: 401 },
      ),
    };
  }

  const role = intro.tools_role;
  if (role === "admin") return { ok: true };

  const keysRaw = intro.tools_nav_keys;
  if (!Array.isArray(keysRaw)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "forbidden_suite",
          message: "缺少工具套件授权信息，请重新连接工具站",
          navKey,
        },
        { status: 403 },
      ),
    };
  }
  const keys = keysRaw.filter((k): k is string => typeof k === "string");
  if (!keys.includes(navKey)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "forbidden_suite",
          message: "当前订阅未包含该工具套件",
          navKey,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}
