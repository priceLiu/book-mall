"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  AiSpacePinEntry,
  WorkflowLaunchSpec,
} from "@/lib/ai-space/ai-space-pin-types";
import { AI_SPACE_PIN_SOURCE_LABEL } from "@/lib/ai-space/ai-space-pin-types";

import {
  AiSpaceConfirmDialog,
  type AiSpaceConfirmRequest,
} from "./ai-space-confirm-dialog";

/** launch.app → Book 侧 SSO 中转页 */
const OPEN_ROUTE: Record<string, string> = {
  ecom: "/ecom-open",
  tools: "/tools-open",
  canvas: "/canvas-open",
  story: "/story-open",
  "quick-replica": "/quick-replica-open",
};

function launchHref(launch: WorkflowLaunchSpec): string | null {
  const route = OPEN_ROUTE[launch.app];
  if (!route) return null;
  const path = launch.query
    ? `${launch.path}?${new URLSearchParams(launch.query).toString()}`
    : launch.path;
  return `${route}?path=${encodeURIComponent(path)}`;
}

function MediaPreview({ entry }: { entry: AiSpacePinEntry }) {
  const { resolved } = entry;
  if (resolved.kind === "audio") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#f6f8fa] p-3">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio className="w-full" controls preload="none" src={resolved.mediaUrl} />
      </div>
    );
  }
  if (resolved.kind === "video") {
    return (
      <video
        className="h-full w-full bg-black object-contain"
        controls
        preload="metadata"
        poster={resolved.thumbnailUrl ?? undefined}
        src={resolved.mediaUrl}
      />
    );
  }
  return (
    // 作品图为 OSS 任意尺寸，走原生 img 避免 next/image 域名白名单维护
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="h-full w-full bg-[#f6f8fa] object-contain"
      src={resolved.thumbnailUrl ?? resolved.mediaUrl}
      alt={entry.caption ?? resolved.title ?? "作品"}
      loading="lazy"
    />
  );
}

export function AiSpacePinWall({
  initialEntries,
}: {
  initialEntries: AiSpacePinEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [busyPinId, setBusyPinId] = useState<string | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<AiSpaceConfirmRequest | null>(null);

  const unpin = useCallback(async (pinId: string) => {
    setBusyPinId(pinId);
    setError(null);
    try {
      const res = await fetch(
        `/api/platform/v1/ai-space/pins?pinId=${encodeURIComponent(pinId)}`,
        { method: "DELETE", credentials: "include" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "取消展示失败");
        return;
      }
      setEntries((prev) => prev.filter((e) => e.pinId !== pinId));
      setConfirmRequest(null);
    } finally {
      setBusyPinId(null);
    }
  }, []);

  const askUnpin = useCallback(
    (entry: AiSpacePinEntry) => {
      setConfirmRequest({
        title: "取消展示",
        message: (
          <>
            <p>
              将「{entry.caption ?? entry.resolved.title ?? "该作品"}」从作品墙移除。
            </p>
            <p>
              <strong>只影响展示</strong>
              ，原作品仍保留在
              {AI_SPACE_PIN_SOURCE_LABEL[entry.sourceType]}中。
            </p>
          </>
        ),
        confirmLabel: "取消展示",
        onConfirm: () => unpin(entry.pinId),
      });
    },
    [unpin],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AiSpacePinEntry[]>();
    for (const e of entries) {
      const key = AI_SPACE_PIN_SOURCE_LABEL[e.sourceType] ?? e.sourceApp;
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()];
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#d0d7de] bg-[#f6f8fa] p-10 text-center">
        <p className="text-sm font-medium text-[#1f2328]">作品墙还空着</p>
        <p className="mt-1 text-sm text-[#656d76]">
          在电商工具箱、AI 工具站或画布里完成作品后，点「展示到 AI 空间」即可布置到这里。
          空间只保存指向，不复制文件。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {grouped.map(([label, list]) => (
        <section key={label} className="space-y-3">
          <h2 className="text-sm font-semibold text-[#1f2328]">
            {label}
            <span className="ml-2 text-xs font-normal text-[#656d76]">{list.length} 件</span>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((entry) => {
              const href = entry.resolved.launch ? launchHref(entry.resolved.launch) : null;
              return (
                <li
                  key={entry.pinId}
                  className="overflow-hidden rounded-lg border border-[#d0d7de] bg-white"
                >
                  <div className="aspect-video">
                    <MediaPreview entry={entry} />
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="truncate text-sm font-medium text-[#1f2328]">
                      {entry.caption ?? entry.resolved.title ?? "未命名作品"}
                    </p>
                    {entry.resolved.prompt ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-[#656d76]">
                        {entry.resolved.prompt}
                      </p>
                    ) : null}
                    <p className="text-xs text-[#8c959f]">
                      {entry.resolved.moduleLabel ? `${entry.resolved.moduleLabel} · ` : ""}
                      {new Date(entry.resolved.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                    <div className="flex gap-2 pt-1">
                      {href ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={href} target="_blank" rel="noreferrer">
                            继续创作
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyPinId === entry.pinId}
                        onClick={() => askUnpin(entry)}
                      >
                        取消展示
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <AiSpaceConfirmDialog
        request={confirmRequest}
        busy={busyPinId !== null}
        onCancel={() => setConfirmRequest(null)}
      />
    </div>
  );
}
