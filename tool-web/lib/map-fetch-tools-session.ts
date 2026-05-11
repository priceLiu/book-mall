import type { FetchToolsSessionResult } from "@/lib/tools-introspect";
import type { ToolShellSession } from "@/lib/tool-shell-session-types";
import { GUEST_TOOL_SHELL_SESSION } from "@/lib/tool-shell-session-types";
import { introspectStringField } from "@/lib/introspect-fields";

/** 将 `fetchToolsSession` / `/api/tools-session` 的载荷映射为壳层会话 */
export function mapFetchToolsSessionResultToShell(
  sess: FetchToolsSessionResult,
): ToolShellSession {
  if (!sess.hasCookie) return GUEST_TOOL_SHELL_SESSION;

  const intro = sess.introspect;

  return {
    active: sess.active,
    email:
      intro && typeof intro === "object"
        ? introspectStringField(intro.email)
        : null,
    name:
      intro && typeof intro === "object"
        ? introspectStringField(intro.name)
        : null,
    image:
      intro && typeof intro === "object"
        ? introspectStringField(intro.image)
        : null,
    sub:
      intro && typeof intro === "object"
        ? introspectStringField((intro as { sub?: unknown }).sub)
        : null,
    toolsRole:
      intro && typeof intro === "object"
        ? introspectStringField((intro as { tools_role?: unknown }).tools_role)
        : null,
  };
}
