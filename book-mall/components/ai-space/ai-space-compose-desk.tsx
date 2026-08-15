"use client";

import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiSpaceAudioAssetDto } from "@/lib/ai-space/ai-space-audio-service";
import {
  AI_SPACE_COMPOSE_DEFAULT_OPTIONS,
  AI_SPACE_S2V_MAX_AUDIO_SEC,
  type AiSpaceComposeOverlayOptions,
  type AiSpaceComposeTaskDto,
} from "@/lib/ai-space/ai-space-compose-types";
import type { AiSpaceDigitalHumanDto } from "@/lib/ai-space/ai-space-digital-human-types";
import type { AiSpaceVideoMaterialDto } from "@/lib/ai-space/ai-space-video-types";

const COMPOSE_API = "/api/platform/v1/ai-space/compose-tasks";
const PINS_API = "/api/platform/v1/ai-space/pins";
const POLL_MS = 5_000;

const POSITION_OPTIONS: Array<{
  id: AiSpaceComposeOverlayOptions["position"];
  label: string;
}> = [
  { id: "bottom-right", label: "右下" },
  { id: "bottom-left", label: "左下" },
  { id: "top-right", label: "右上" },
  { id: "top-left", label: "左上" },
  { id: "center", label: "居中" },
];

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "时长未知";
  return `${sec.toFixed(1)} 秒`;
}

function isRunning(status: string): boolean {
  return status === "pending" || status === "generating_human" || status === "composing";
}

export function AiSpaceComposeDesk({
  digitalHumans,
  audioAssets,
  backgrounds,
  initialTasks,
}: {
  digitalHumans: AiSpaceDigitalHumanDto[];
  audioAssets: AiSpaceAudioAssetDto[];
  backgrounds: AiSpaceVideoMaterialDto[];
  initialTasks: AiSpaceComposeTaskDto[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [humanId, setHumanId] = useState(digitalHumans[0]?.id ?? "");
  const [audioId, setAudioId] = useState(
    audioAssets.find((a) => a.durationSec > 0 && a.durationSec < AI_SPACE_S2V_MAX_AUDIO_SEC)
      ?.id ?? "",
  );
  const [backgroundId, setBackgroundId] = useState("");
  const [options, setOptions] = useState<AiSpaceComposeOverlayOptions>(
    AI_SPACE_COMPOSE_DEFAULT_OPTIONS,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const selectedAudio = useMemo(
    () => audioAssets.find((a) => a.id === audioId) ?? null,
    [audioAssets, audioId],
  );
  const audioTooLong =
    !!selectedAudio && selectedAudio.durationSec >= AI_SPACE_S2V_MAX_AUDIO_SEC;
  const audioUnknown = !!selectedAudio && selectedAudio.durationSec <= 0;
  const hasRunning = tasks.some((t) => isRunning(t.status));

  const refresh = useCallback(async () => {
    const res = await fetch(COMPOSE_API, { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as {
      tasks?: AiSpaceComposeTaskDto[];
    };
    if (data.tasks) setTasks(data.tasks);
  }, []);

  // 无常驻 worker：前台轮询同时推进队列（S2V 厂商并发 1）
  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [hasRunning, refresh]);

  const submit = useCallback(async () => {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const res = await fetch(COMPOSE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          digitalHumanId: humanId,
          audioAssetId: audioId,
          videoMaterialId: backgroundId || null,
          options,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        task?: AiSpaceComposeTaskDto;
        error?: string;
      };
      if (!res.ok || !data.task) {
        setError(data.error ?? "创建合成任务失败");
        return;
      }
      setTasks((prev) => [data.task!, ...prev]);
      setNotice("已提交，口播生成与合成会在后台依次进行");
    } finally {
      setSubmitting(false);
    }
  }, [audioId, backgroundId, humanId, options]);

  const pinToWall = useCallback(async (task: AiSpaceComposeTaskDto) => {
    setError(null);
    setNotice(null);
    setPinningId(task.id);
    try {
      // 成片已入视频创作库，Pin 指向该记录而非任务
      const listRes = await fetch(
        "/api/platform/v1/ai-space/video-materials?ownedOnly=1",
        { credentials: "include" },
      );
      const listData = (await listRes.json().catch(() => ({}))) as {
        materials?: AiSpaceVideoMaterialDto[];
      };
      const material = listData.materials?.find((m) => m.composeTaskId === task.id);
      if (!material) {
        setError("未找到成片记录，请刷新后重试");
        return;
      }
      const res = await fetch(PINS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceType: "ai_space_video", sourceId: material.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "展示到作品墙失败");
        return;
      }
      setNotice("已展示到作品墙");
    } finally {
      setPinningId(null);
    }
  }, []);

  const canSubmit =
    !!humanId && !!audioId && !audioTooLong && !audioUnknown && !submitting;

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-[#1a7f37]">{notice}</p> : null}

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">1 · 选数字人形象</h2>
        {digitalHumans.length === 0 ? (
          <p className="mt-2 text-sm text-[#656d76]">
            数字人库还没有可用形象，请先到「数字人库」上传。
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-3">
            {digitalHumans.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => setHumanId(h.id)}
                  className={`w-28 overflow-hidden rounded-lg border text-left transition ${
                    humanId === h.id
                      ? "border-[#0969da] ring-2 ring-[#0969da]/25"
                      : "border-[#d0d7de] hover:border-[#8c959f]"
                  }`}
                >
                  <span className="relative block aspect-[3/4] bg-[#f6f8fa]">
                    <Image
                      src={h.avatarImageUrl}
                      alt={h.name}
                      fill
                      sizes="112px"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                  <span className="block truncate px-2 py-1.5 text-xs text-[#1f2328]">
                    {h.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">2 · 选口播音频</h2>
        <p className="mt-1 text-xs text-[#656d76]">
          数字人模型要求音频时长小于 {AI_SPACE_S2V_MAX_AUDIO_SEC} 秒；更长的台词请拆成多条分别合成。
        </p>
        {audioAssets.length === 0 ? (
          <p className="mt-2 text-sm text-[#656d76]">
            音频库还是空的，请先到「音频库」生成或上传。
          </p>
        ) : (
          <select
            className="mt-3 h-9 w-full max-w-xl rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
            value={audioId}
            onChange={(e) => setAudioId(e.target.value)}
          >
            <option value="">请选择音频</option>
            {audioAssets.map((a) => (
              <option
                key={a.id}
                value={a.id}
                disabled={a.durationSec <= 0 || a.durationSec >= AI_SPACE_S2V_MAX_AUDIO_SEC}
              >
                {a.name} · {formatDuration(a.durationSec)}
                {a.durationSec >= AI_SPACE_S2V_MAX_AUDIO_SEC ? "（超时长）" : ""}
                {a.durationSec <= 0 ? "（时长未知）" : ""}
              </option>
            ))}
          </select>
        )}
        {audioTooLong ? (
          <p className="mt-2 text-sm text-destructive">
            该音频 {formatDuration(selectedAudio.durationSec)}，超过 {AI_SPACE_S2V_MAX_AUDIO_SEC} 秒上限。
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">3 · 选背景与画中画设置</h2>
        <p className="mt-1 text-xs text-[#656d76]">
          不选背景时只输出口播视频本身；选背景后数字人会缩放叠加在背景之上，背景不足则循环铺底。
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-[#656d76]">
            <span>背景视频</span>
            <select
              className="h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
              value={backgroundId}
              onChange={(e) => setBackgroundId(e.target.value)}
            >
              <option value="">不叠背景</option>
              {backgrounds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {formatDuration(b.durationSec)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-[#656d76]">
            <span>口播分辨率</span>
            <select
              className="h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
              value={options.resolution}
              onChange={(e) =>
                setOptions((p) => ({
                  ...p,
                  resolution: e.target.value === "720P" ? "720P" : "480P",
                }))
              }
            >
              <option value="480P">480P（更快）</option>
              <option value="720P">720P</option>
            </select>
          </label>

          <label className="space-y-1 text-xs text-[#656d76]">
            <span>数字人占背景宽度：{Math.round(options.scale * 100)}%</span>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              className="w-full"
              value={Math.round(options.scale * 100)}
              onChange={(e) =>
                setOptions((p) => ({ ...p, scale: Number(e.target.value) / 100 }))
              }
            />
          </label>

          <label className="space-y-1 text-xs text-[#656d76]">
            <span>画中画位置</span>
            <select
              className="h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
              value={options.position}
              onChange={(e) =>
                setOptions((p) => ({
                  ...p,
                  position: e.target.value as AiSpaceComposeOverlayOptions["position"],
                }))
              }
            >
              {POSITION_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-[#656d76]">
          <input
            type="checkbox"
            checked={options.burnSubtitle}
            onChange={(e) =>
              setOptions((p) => ({ ...p, burnSubtitle: e.target.checked }))
            }
          />
          烧录台词字幕（仅对有台词文本的合成音频有效，按时长均分）
        </label>

        <div className="mt-4 flex items-center gap-3">
          <Button type="button" disabled={!canSubmit} onClick={() => void submit()}>
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                提交中…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                开始合成
              </>
            )}
          </Button>
          <span className="text-xs text-[#8c959f]">
            厂商同时只处理 1 个口播任务，多条会自动排队。
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#1f2328]">合成记录</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-[#656d76]">还没有合成任务。</p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-[#d0d7de] bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-[#1f2328]">
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-[#1a7f37]" />
                    ) : task.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-[#0969da]" />
                    )}
                    <span>{task.statusLabel}</span>
                    <span className="text-xs text-[#8c959f]">
                      {new Date(task.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  {task.status === "completed" && task.finalVideoUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pinningId === task.id}
                      onClick={() => void pinToWall(task)}
                    >
                      {pinningId === task.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      展示到作品墙
                    </Button>
                  ) : null}
                </div>

                {isRunning(task.status) ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#eaeef2]">
                    <div
                      className="h-full rounded-full bg-[#0969da] transition-all"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                ) : null}

                {task.errorMessage ? (
                  <p className="mt-2 text-xs text-destructive">
                    {task.errorMessage}
                    {task.gatewayLogId ? `（Gateway 日志 ${task.gatewayLogId}）` : ""}
                  </p>
                ) : null}

                {task.finalVideoUrl ? (
                  <video
                    className="mt-3 aspect-video w-full max-w-lg rounded-md bg-black object-contain"
                    controls
                    preload="metadata"
                    src={task.finalVideoUrl}
                  />
                ) : task.tempHumanVideoUrl ? (
                  <video
                    className="mt-3 aspect-video w-full max-w-sm rounded-md bg-black object-contain"
                    controls
                    preload="metadata"
                    src={task.tempHumanVideoUrl}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
