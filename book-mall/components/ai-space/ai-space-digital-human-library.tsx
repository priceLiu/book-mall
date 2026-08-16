"use client";

import { Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AI_SPACE_DIGITAL_HUMAN_MAX_EDGE,
  AI_SPACE_DIGITAL_HUMAN_MIN_EDGE,
  type AiSpaceDigitalHumanDetect,
  type AiSpaceDigitalHumanDto,
} from "@/lib/ai-space/ai-space-digital-human-types";

import { AiSpaceConfirmDialog, type AiSpaceConfirmRequest } from "./ai-space-confirm-dialog";
import { AiSpaceFavoriteButton } from "./ai-space-favorite-button";

const API = "/api/platform/v1/ai-space/digital-humans";

const STATUS_LABEL: Record<string, string> = {
  active: "可用",
  inactive: "已停用",
  detect_failed: "形象检测未通过",
};

export function AiSpaceDigitalHumanLibrary({
  initialItems,
}: {
  initialItems: Array<AiSpaceDigitalHumanDto & { isFavorite?: boolean }>;
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<AiSpaceConfirmRequest | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(API, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: AiSpaceDigitalHumanDto;
        warning?: string;
        error?: string;
      };
      if (!res.ok || !data.item) {
        setError(data.error ?? "上传失败");
        return;
      }
      setItems((prev) => [data.item!, ...prev]);
      if (data.warning) setError(data.warning);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  const patch = useCallback(
    async (id: string, body: { name?: string; status?: "active" | "inactive" }) => {
      setError(null);
      setBusyId(id);
      try {
        const res = await fetch(API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id, ...body }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "更新失败");
          return;
        }
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...body } : i)));
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const redetect = useCallback(async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, action: "detect" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        detect?: AiSpaceDigitalHumanDetect;
        warning?: string;
        error?: string;
      };
      if (!res.ok || !data.detect) {
        setError(data.error ?? "形象检测失败");
        return;
      }
      const detect = data.detect;
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                detect,
                status: detect.checkPass
                  ? i.status === "detect_failed"
                    ? "active"
                    : i.status
                  : "detect_failed",
              }
            : i,
        ),
      );
      if (data.warning) setError(data.warning);
    } finally {
      setBusyId(null);
    }
  }, []);

  const doDelete = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "删除失败");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
      setConfirmRequest(null);
    } finally {
      setBusyId(null);
    }
  }, []);

  const askDelete = useCallback(
    async (item: AiSpaceDigitalHumanDto) => {
      setError(null);
      let refs = { composeTaskCount: 0, composeTaskStatuses: [] as string[] };
      try {
        const res = await fetch(`${API}?checkRefsFor=${encodeURIComponent(item.id)}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          refs?: { composeTaskCount: number; composeTaskStatuses: string[] };
        };
        if (data.refs) refs = data.refs;
      } catch {
        // 引用检测失败不阻断，第二次确认仍会提示不可恢复
      }

      setConfirmRequest({
        title: "删除数字人形象",
        message: (
          <>
            <p>将从数字人库删除「{item.name}」。</p>
            {refs.composeTaskCount > 0 ? (
              <p>
                该形象已被 <strong>{refs.composeTaskCount}</strong> 个合成任务引用（
                {refs.composeTaskStatuses.join(" / ")}）。
              </p>
            ) : null}
          </>
        ),
        confirmLabel: "继续",
        onConfirm: () =>
          setConfirmRequest({
            title: "再次确认删除",
            variant: "destructive",
            message: (
              <>
                <p>
                  删除后 <strong>不可恢复</strong>，同时会清理 <strong>云端存储（OSS）</strong> 上的形象图。
                </p>
                <p>其它应用若以 digitalHumanId 引用该形象，引用将失效。</p>
              </>
            ),
            confirmLabel: "确认删除",
            onConfirm: () => doDelete(item.id),
          }),
      });
    },
    [doDelete],
  );

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">上传形象</h2>
        <p className="mt-1 text-xs text-[#656d76]">
          正面、半身、五官清晰的单人照效果最好。尺寸要求：最短边大于{" "}
          {AI_SPACE_DIGITAL_HUMAN_MIN_EDGE}px、最长边小于 {AI_SPACE_DIGITAL_HUMAN_MAX_EDGE}px。
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        <Button
          className="mt-3"
          type="button"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              上传中…
            </>
          ) : (
            <>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              选择形象图
            </>
          )}
        </Button>
      </section>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#d0d7de] bg-[#f6f8fa] p-10 text-center">
          <p className="text-sm font-medium text-[#1f2328]">数字人库还是空的</p>
          <p className="mt-1 text-sm text-[#656d76]">
            上传形象后即可在合成台生成口播视频，其它应用也能直接引用同一条形象记录。
          </p>
        </div>
      ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-lg border border-[#d0d7de] bg-white"
            >
              <div className="relative aspect-[3/4] bg-[#f6f8fa]">
                {/* 形象图为 OSS 任意尺寸，走原生 img 避免 next/image 域名白名单维护 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-full w-full object-cover"
                  src={item.avatarImageUrl}
                  alt={item.name}
                  loading="lazy"
                />
                <div className="absolute right-2 top-2">
                  <AiSpaceFavoriteButton
                    targetKind="digital_human"
                    targetId={item.id}
                    initialFavorite={item.isFavorite}
                  />
                </div>
              </div>
              <div className="space-y-2 p-3">
                <Input
                  className="h-8 text-sm"
                  defaultValue={item.name}
                  disabled={busyId === item.id}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== item.name) void patch(item.id, { name: next });
                  }}
                />
                <p className="text-xs text-[#8c959f]">
                  {STATUS_LABEL[item.status] ?? item.status}
                  {item.width && item.height ? ` · ${item.width}×${item.height}` : ""} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                </p>
                <p className="text-xs">
                  {item.detect === null ? (
                    <span className="text-[#8c959f]">未做口播预检 · 首次合成时自动检测</span>
                  ) : item.detect.checkPass ? (
                    <span className="text-[#1a7f37]">口播预检通过</span>
                  ) : (
                    <span className="text-destructive">
                      {item.detect.humanoid === false
                        ? "预检未通过：未检测到人像"
                        : "预检未通过：形象图不符合口播要求"}
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() =>
                      void patch(item.id, {
                        status: item.status === "active" ? "inactive" : "active",
                      })
                    }
                  >
                    {item.status === "active" ? "停用" : "启用"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() => void redetect(item.id)}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "重新预检"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => void askDelete(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AiSpaceConfirmDialog
        request={confirmRequest}
        busy={busyId !== null}
        onCancel={() => setConfirmRequest(null)}
      />
    </div>
  );
}
