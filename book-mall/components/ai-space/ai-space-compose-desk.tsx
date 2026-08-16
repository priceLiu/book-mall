"use client";

import { Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AiSpaceComposeFavoriteAudio,
  AiSpaceComposeFavoriteHumans,
} from "@/components/ai-space/ai-space-compose-favorites";
import { useAiSpaceComposeTasks } from "@/components/ai-space/ai-space-compose-tasks-context";
import { Button } from "@/components/ui/button";
import type { AiSpaceAudioAssetDto } from "@/lib/ai-space/ai-space-audio-service";
import { AI_SPACE_COMPOSE_FROM_TASK_PARAM } from "@/lib/ai-space/ai-space-compose-options";
import {
  AI_SPACE_COMPOSE_DEFAULT_OPTIONS,
  AI_SPACE_S2V_MAX_AUDIO_SEC,
  type AiSpaceComposeOverlayOptions,
  type AiSpaceComposeTaskDto,
} from "@/lib/ai-space/ai-space-compose-types";
import type { AiSpaceDigitalHumanDto } from "@/lib/ai-space/ai-space-digital-human-types";
import type { AiSpaceVideoMaterialDto } from "@/lib/ai-space/ai-space-video-types";

const COMPOSE_API = "/api/platform/v1/ai-space/compose-tasks";

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

export function AiSpaceComposeDesk({
  digitalHumans,
  audioAssets,
  backgrounds,
}: {
  digitalHumans: Array<AiSpaceDigitalHumanDto & { isFavorite?: boolean }>;
  audioAssets: Array<AiSpaceAudioAssetDto & { isFavorite?: boolean }>;
  backgrounds: AiSpaceVideoMaterialDto[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTaskId = searchParams.get(AI_SPACE_COMPOSE_FROM_TASK_PARAM)?.trim() ?? "";
  const { tasks } = useAiSpaceComposeTasks();
  const appliedFromTaskRef = useRef<string | null>(null);

  const [humanId, setHumanId] = useState(
    () => digitalHumans.find((h) => h.isFavorite)?.id ?? digitalHumans[0]?.id ?? "",
  );
  const [audioId, setAudioId] = useState(() => {
    const fav = audioAssets.find(
      (a) =>
        a.isFavorite &&
        a.durationSec > 0 &&
        a.durationSec < AI_SPACE_S2V_MAX_AUDIO_SEC,
    );
    if (fav) return fav.id;
    return (
      audioAssets.find((a) => a.durationSec > 0 && a.durationSec < AI_SPACE_S2V_MAX_AUDIO_SEC)
        ?.id ?? ""
    );
  });
  const [backgroundId, setBackgroundId] = useState("");
  const [options, setOptions] = useState<AiSpaceComposeOverlayOptions>(
    AI_SPACE_COMPOSE_DEFAULT_OPTIONS,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { addTask } = useAiSpaceComposeTasks();

  useEffect(() => {
    if (!fromTaskId || appliedFromTaskRef.current === fromTaskId) return;

    let cancelled = false;

    void (async () => {
      let task: AiSpaceComposeTaskDto | null =
        tasks.find((t) => t.id === fromTaskId) ?? null;
      if (!task) {
        const res = await fetch(
          `${COMPOSE_API}?id=${encodeURIComponent(fromTaskId)}`,
          { credentials: "include" },
        );
        const data = (await res.json().catch(() => ({}))) as {
          task?: AiSpaceComposeTaskDto;
        };
        task = data.task ?? null;
      }
      if (cancelled) return;

      if (!task) {
        setError("未找到该任务，无法载入合成参数");
        return;
      }

      appliedFromTaskRef.current = fromTaskId;
      const warnings: string[] = [];

      if (digitalHumans.some((h) => h.id === task.digitalHumanId)) {
        setHumanId(task.digitalHumanId);
      } else {
        warnings.push("原数字人形象已不可用");
      }

      if (audioAssets.some((a) => a.id === task.audioAssetId)) {
        setAudioId(task.audioAssetId);
      } else {
        warnings.push("原口播音频已不可用");
      }

      if (task.videoMaterialId) {
        if (backgrounds.some((b) => b.id === task.videoMaterialId)) {
          setBackgroundId(task.videoMaterialId);
        } else {
          warnings.push("原背景视频已不可用");
        }
      } else {
        setBackgroundId("");
      }

      setOptions(task.options);
      setError(null);
      setNotice(
        warnings.length > 0
          ? `已载入任务参数（${warnings.join("；")}，请检查后再提交）`
          : "已载入任务参数，可修改后重新提交",
      );

      const params = new URLSearchParams(searchParams.toString());
      params.delete(AI_SPACE_COMPOSE_FROM_TASK_PARAM);
      router.replace(`/account/ai-space?${params.toString()}`, { scroll: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    audioAssets,
    backgrounds,
    digitalHumans,
    fromTaskId,
    router,
    searchParams,
    tasks,
  ]);

  const selectedAudio = useMemo(
    () => audioAssets.find((a) => a.id === audioId) ?? null,
    [audioAssets, audioId],
  );
  const audioTooLong =
    !!selectedAudio && selectedAudio.durationSec >= AI_SPACE_S2V_MAX_AUDIO_SEC;
  const audioUnknown = !!selectedAudio && selectedAudio.durationSec <= 0;

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
      addTask(data.task);
      setNotice("已提交，进度可在右下角小窗查看");
    } finally {
      setSubmitting(false);
    }
  }, [addTask, audioId, backgroundId, humanId, options]);

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
          <>
            <AiSpaceComposeFavoriteHumans
              items={digitalHumans}
              selectedId={humanId}
              onSelect={setHumanId}
            />
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
          </>
        )}
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">2 · 选口播音频</h2>
        <AiSpaceComposeFavoriteAudio
          items={audioAssets}
          selectedId={audioId}
          onSelect={setAudioId}
        />
        <p className="mt-1 text-xs text-[#656d76]">
          数字人模型要求音频时长小于 {AI_SPACE_S2V_MAX_AUDIO_SEC} 秒；更长的台词请拆成多条分别合成。
        </p>
        {audioAssets.length === 0 ? (
          <p className="mt-2 text-sm text-[#656d76]">
            音频库还是空的，请先到「音频库」生成或上传。
          </p>
        ) : (
          <select
            className="mt-3 h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
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

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            厂商同时只处理 1 个口播任务，多条会自动排队；进度在右下角小窗。
          </span>
        </div>
      </section>
    </div>
  );
}
