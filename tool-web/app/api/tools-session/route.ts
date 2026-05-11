import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  toolsDiagnosticsEnabled,
  toolsSessionServerTiming,
} from "@/lib/tools-diagnostics";
import { logToolsSessionDiagToConsole } from "@/lib/tools-session-console-log";
import { fetchToolsSessionUncachedWithDiag } from "@/lib/tools-introspect";

export const dynamic = "force-dynamic";

/**
 * 浏览器异步拉取会话：JWT 快路径极快；回落 introspect 时不阻塞根布局 RSC。
 *
 * 观测：
 * - `X-Tools-Session-Path`：jwt_local | introspect_http | …
 * - `Server-Timing`：session / jwt / introspect 分段耗时（毫秒）
 * - `TOOLS_DIAGNOSTICS=1` 时 JSON 根级附带 `_diag`
 * - `NODE_ENV=development` 或 `TOOLS_DIAGNOSTICS=1` 时在**工具站服务端终端**打印一行摘要与解读（不含令牌）
 */
export async function GET() {
  const jar = cookies();
  const token = jar.get("tools_token")?.value;
  const { session, diag } = await fetchToolsSessionUncachedWithDiag(token);
  logToolsSessionDiagToConsole(session, diag);

  const showDiag = toolsDiagnosticsEnabled();
  const body =
    showDiag ? { ...session, _diag: diag } : session;

  const res = NextResponse.json(body);
  res.headers.set("X-Tools-Session-Path", diag.path);
  res.headers.set("Server-Timing", toolsSessionServerTiming(diag));
  return res;
}
