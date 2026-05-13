import type { FetchToolsSessionResult } from "@/lib/tools-introspect";
import type { ToolShellSession } from "@/lib/tool-shell-session-types";
import { GUEST_TOOL_SHELL_SESSION } from "@/lib/tool-shell-session-types";
import { introspectStringField } from "@/lib/introspect-fields";

function introspectToolsNavKeys(intro: Record<string, unknown>): string[] | null {
  const raw = intro.tools_nav_keys;
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (t && t.length <= 64) out.push(t);
  }
  return out;
}

/** 将 `fetchToolsSession` / `/api/tools-session` 的载荷映射为壳层会话 */
export function mapFetchToolsSessionResultToShell(
  sess: FetchToolsSessionResult,
): ToolShellSession {
  if (!sess.hasCookie) return GUEST_TOOL_SHELL_SESSION;

  const intro = sess.introspect;

  if (!intro || typeof intro !== "object") {
    return {
      ...GUEST_TOOL_SHELL_SESSION,
      active: sess.active,
    };
  }

  const introObj = intro as Record<string, unknown>;
  const keys = introspectToolsNavKeys(introObj);

  return {
    active: sess.active,
    email: introspectStringField(introObj.email),
    name: introspectStringField(introObj.name),
    image: introspectStringField(introObj.image),
    sub: introspectStringField(introObj.sub),
    toolsRole: introspectStringField(introObj.tools_role),
    toolsNavKeys: keys,
  };
}
