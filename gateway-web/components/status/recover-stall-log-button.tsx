"use client";

import { useState } from "react";

function isRecoverableStallRow(
  failCode?: string | null,
  failMessage?: string | null,
): boolean {
  if (failCode === "VOLCENGINE_GATEWAY_POLL_STALL") return true;
  const msg = failMessage ?? "";
  return msg.includes("停更") || msg.includes("判定卡死");
}

export function RecoverStallLogButton({
  logId,
  failCode,
  failMessage,
  onDone,
}: {
  logId: string;
  failCode?: string | null;
  failMessage?: string | null;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isRecoverableStallRow(failCode, failMessage)) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setMsg(null);
            try {
              const res = await fetch(
                `/api/book-mall/api/gateway/logs/${encodeURIComponent(logId)}/recover`,
                { method: "POST" },
              );
              const body = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                action?: string;
                message?: string;
              };
              if (res.ok && body.ok) {
                setMsg("已恢复");
                onDone?.();
              } else {
                setMsg(body.message ?? "厂商仍在生成");
              }
            } catch {
              setMsg("请求失败");
            } finally {
              setBusy(false);
            }
          })();
        }}
        className="gw-btn-xs disabled:opacity-60"
      >
        {busy ? "复核中…" : "厂商复核恢复"}
      </button>
      {msg ? <span className="text-[10px] text-[var(--gw-muted)]">{msg}</span> : null}
    </div>
  );
}
