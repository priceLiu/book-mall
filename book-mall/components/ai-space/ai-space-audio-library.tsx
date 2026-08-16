"use client";

import { Loader2, Mic, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AiSpaceAudioControls } from "@/components/ai-space/ai-space-audio-controls";
import { AiSpaceFavoriteButton } from "@/components/ai-space/ai-space-favorite-button";
import {
  AiSpaceVoiceGallery,
  type AiSpaceVoiceCatalogItem,
} from "@/components/ai-space/ai-space-voice-gallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiSpaceAudioAssetDto } from "@/lib/ai-space/ai-space-audio-service";
import { openQuickReplicaAppInNewTab } from "@/lib/account-app-launch";
import {
  AI_SPACE_TTS_DEFAULT_MODEL_KEY,
  AI_SPACE_TTS_MINIMAX_MODELS,
  AI_SPACE_TTS_MODELS,
  AI_SPACE_TTS_TEXT_MAX,
  getAiSpaceTtsModelDef,
} from "@/lib/ai-space/ai-space-tts-catalog";
import { isMinimaxSpeechModelKey } from "@/lib/gateway/minimax-speech-models";

import {
  AiSpaceConfirmDialog,
  type AiSpaceConfirmRequest,
} from "./ai-space-confirm-dialog";
import { AiSpaceTtsVoiceControlsPanel } from "./ai-space-tts-voice-controls-panel";
import {
  AI_SPACE_TTS_VOICE_CONTROL_DEFAULTS,
  type AiSpaceTtsVoiceControls,
} from "@/lib/ai-space/ai-space-tts-voice-controls";

const SOURCE_LABEL: Record<string, string> = {
  upload: "本地上传",
  tts: "语音合成",
  voice_clone: "声音克隆",
  voice_changer: "变声",
  sound_effect: "音效",
  music: "音乐",
};

const API = "/api/platform/v1/ai-space/audio-assets";
const FAV_API = "/api/platform/v1/ai-space/favorites";

type AudioAssetRow = AiSpaceAudioAssetDto & { isFavorite?: boolean };

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return "时长未知";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}分${s.toString().padStart(2, "0")}秒` : `${s.toFixed(0)} 秒`;
}

export function AiSpaceAudioLibrary({
  initialAssets,
}: {
  initialAssets: AudioAssetRow[];
}) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<AiSpaceConfirmRequest | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [modelKey, setModelKey] = useState(AI_SPACE_TTS_DEFAULT_MODEL_KEY);
  const modelDef = getAiSpaceTtsModelDef(modelKey);
  const isMinimax = isMinimaxSpeechModelKey(modelKey);
  const [selectedVoice, setSelectedVoice] = useState<AiSpaceVoiceCatalogItem | null>(null);
  const [voice, setVoice] = useState("");
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [voiceControls, setVoiceControls] = useState<AiSpaceTtsVoiceControls>(
    AI_SPACE_TTS_VOICE_CONTROL_DEFAULTS,
  );
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void fetch(`${FAV_API}?targetKind=tts_voice`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { favorites?: Array<{ targetId: string }> }) => {
        const ids = data.favorites?.map((f) => f.targetId) ?? [];
        setFavoriteVoiceIds(new Set(ids));
      })
      .catch(() => undefined);
  }, []);

  const resetFeedback = () => {
    setError(null);
    setNotice(null);
  };

  const onUpload = useCallback(async (file: File) => {
    resetFeedback();
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/upload`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        asset?: AiSpaceAudioAssetDto;
        error?: string;
      };
      if (!res.ok || !data.asset) {
        setError(data.error ?? "上传失败");
        return;
      }
      setAssets((prev) => [data.asset!, ...prev]);
      setNotice("已保存到我的音频库");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [router]);

  const onGenerate = useCallback(async () => {
    resetFeedback();
    if (!text.trim()) {
      setError("请先填写台词");
      return;
    }
    if (isMinimax && !selectedVoice && !voice.trim()) {
      setError("请先选择音色");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`${API}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          modelKey,
          voice: isMinimax ? selectedVoice?.voiceId ?? voice : voice,
          text,
          instruction: instruction.trim() || undefined,
          emotion: voiceControls.emotion ?? undefined,
          speed: voiceControls.speed,
          volume: voiceControls.volume,
          pitch: voiceControls.pitch,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        asset?: AiSpaceAudioAssetDto;
        error?: string;
        logId?: string;
      };
      if (!res.ok || !data.asset) {
        setError(
          data.logId ? `${data.error ?? "合成失败"}（日志 ${data.logId}）` : (data.error ?? "合成失败"),
        );
        return;
      }
      setAssets((prev) => [data.asset!, ...prev]);
      setText("");
      setNotice("已生成并保存到我的音频库");
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }, [instruction, isMinimax, modelKey, router, selectedVoice, text, voice, voiceControls]);

  const rename = useCallback(async (id: string, name: string) => {
    resetFeedback();
    setBusyId(id);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, name }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "重命名失败");
        return;
      }
      setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, name } : a)));
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
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setConfirmRequest(null);
      setNotice("已删除");
    } finally {
      setBusyId(null);
    }
  }, []);

  /** 破坏性删除：两次确认，第二次写明云端存储（OSS）不可恢复 */
  const askDelete = useCallback(
    async (asset: AiSpaceAudioAssetDto) => {
      resetFeedback();
      let refs = {
        composeTaskCount: 0,
        composeTaskStatuses: [] as string[],
        blockRefCount: 0,
      };
      try {
        const res = await fetch(`${API}?checkRefsFor=${encodeURIComponent(asset.id)}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          refs?: {
            composeTaskCount: number;
            composeTaskStatuses: string[];
            blockRefCount?: number;
          };
        };
        if (data.refs) {
          refs = { ...data.refs, blockRefCount: data.refs.blockRefCount ?? 0 };
        }
      } catch {
        // 引用检测失败不阻断，第二次确认仍会提示不可恢复
      }

      setConfirmRequest({
        title: "删除音频",
        message: (
          <>
            <p>将从我的音频库删除「{asset.name}」。</p>
            {refs.composeTaskCount > 0 ? (
              <p>
                该音频已被 <strong>{refs.composeTaskCount}</strong> 个合成任务引用（
                {refs.composeTaskStatuses.join(" / ")}），删除后这些任务无法重跑。
              </p>
            ) : null}
            {refs.blockRefCount > 0 ? (
              <p>
                作品墙画布上有 <strong>{refs.blockRefCount}</strong> 处引用，删除后这些位置会变成「素材已删除」占位。
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
                  删除后 <strong>不可恢复</strong>，同时会清理 <strong>云端存储（OSS）</strong> 上的音频文件。
                </p>
                <p>若快速复刻等应用还在引用同一文件，请先确认无需保留。</p>
              </>
            ),
            confirmLabel: "确认删除",
            onConfirm: () => doDelete(asset.id),
          }),
      });
    },
    [doDelete],
  );

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-[#1a7f37]">{notice}</p> : null}

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">生成口播</h2>
        <p className="mt-1 text-xs text-[#656d76]">
          此处选的是 TTS <strong className="font-medium text-[#1f2328]">音色</strong>（谁来说话），不是下方「我的音频库」里上传的口播文件。
          MiniMax 请在「音色列表」点选；百炼请用「音色」下拉。要用自己的人声做音色，请打开
          <button
            type="button"
            className="text-[#0969da] hover:underline"
            onClick={() => openQuickReplicaAppInNewTab("/")}
          >
            快速复制 · 声音克隆
          </button>
          ，克隆成功后会出现在下方「我的克隆音色」中（须与 AI 空间使用同一把 Gateway Key 及 MiniMax 凭证）。
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-1 text-xs text-[#656d76]">
            <span>语音模型</span>
            <select
              className="h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
              value={modelKey}
              onChange={(e) => {
                const next = e.target.value;
                setModelKey(next);
                setVoiceControls(AI_SPACE_TTS_VOICE_CONTROL_DEFAULTS);
                if (!isMinimaxSpeechModelKey(next)) {
                  setVoice(getAiSpaceTtsModelDef(next).voices[0]?.id ?? "");
                  setSelectedVoice(null);
                }
              }}
            >
              <optgroup label="MiniMax（与快速复制一致）">
                {AI_SPACE_TTS_MINIMAX_MODELS.map((m) => (
                  <option key={m.modelKey} value={m.modelKey}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="百炼">
                {AI_SPACE_TTS_MODELS.map((m) => (
                  <option key={m.modelKey} value={m.modelKey}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          {!isMinimax ? (
            <label className="space-y-1 text-xs text-[#656d76]">
              <span>音色</span>
              <select
                className="h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
              >
                {modelDef.voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          ) : selectedVoice ? (
            <div className="space-y-1 text-xs text-[#656d76]">
              <span>已选音色</span>
              <p className="rounded-md border border-[#0969da]/30 bg-[#f0f6ff] px-2 py-2 text-sm text-[#1f2328]">
                {selectedVoice.label}
              </p>
            </div>
          ) : null}
        </div>

        <p className="mt-2 text-xs text-[#8c959f]">{modelDef.description}</p>

        <div className="mt-4">
          <AiSpaceVoiceGallery
            selectedVoiceId={selectedVoice?.voiceId}
            favoriteVoiceIds={favoriteVoiceIds}
            selectionEnabled={isMinimax}
            onSelectVoice={(v) => {
              setSelectedVoice(v);
              setVoice(v.voiceId);
            }}
          />
        </div>

        {!isMinimax ? (
          <p className="mt-2 text-xs text-[#656d76]">
            百炼模型不支持 MiniMax 克隆音色；要用人声克隆生成口播，请把「语音模型」改为 MiniMax（如 speech-2.8-hd）。
          </p>
        ) : null}

        <AiSpaceTtsVoiceControlsPanel
          variant={isMinimax ? "minimax" : "bailian"}
          controls={voiceControls}
          instruction={instruction}
          onControlsChange={setVoiceControls}
          onInstructionChange={setInstruction}
        />

        <Textarea
          className="mt-3 min-h-[96px] w-full resize-y"
          maxLength={AI_SPACE_TTS_TEXT_MAX}
          placeholder="输入台词，建议单条不超过 20 秒，便于后续数字人口播合成"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={generating} onClick={() => void onGenerate()}>
            {generating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                合成中…
              </>
            ) : (
              <>
                <Mic className="mr-1.5 h-3.5 w-3.5" />
                生成音频
              </>
            )}
          </Button>
          <span className="text-xs text-[#8c959f]">
            {text.length}/{AI_SPACE_TTS_TEXT_MAX}
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">我的音频库</h2>
        <p className="mt-1 text-xs text-[#656d76]">
          保存的是<strong className="font-medium text-[#1f2328]">口播内容</strong>（数字人要念的那段声音），供合成台 S2V 使用；
          不能当作上方「生成口播」的音色。支持 mp3 / wav / m4a 等，单文件不超过 50MB。
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
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
          variant="outline"
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
              上传本地音频
            </>
          )}
        </Button>

        {assets.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-[#d0d7de] bg-[#f6f8fa] p-8 text-center">
            <p className="text-sm font-medium text-[#1f2328]">我的音频库还是空的</p>
            <p className="mt-1 text-sm text-[#656d76]">
              上传本地文件，或用上方「生成口播」合成；快速复刻里生成的音频也会自动汇入这里。
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="rounded-lg border border-[#d0d7de] bg-white p-3 lg:p-4"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      className="h-8 w-full text-sm"
                      defaultValue={asset.name}
                      disabled={busyId === asset.id}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== asset.name) void rename(asset.id, next);
                      }}
                    />
                    <p className="text-xs text-[#8c959f]">
                      {SOURCE_LABEL[asset.sourceType] ?? asset.sourceType} ·{" "}
                      {formatDuration(asset.durationSec)}
                      {asset.originApp === "quick-replica" ? " · 来自快速复刻" : ""} ·{" "}
                      {new Date(asset.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                    {asset.textScript ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-[#656d76]">
                        {asset.textScript}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex w-full min-w-0 items-center gap-2 xl:w-auto xl:min-w-[16rem] xl:max-w-xl xl:flex-1 xl:justify-end">
                    <AiSpaceFavoriteButton
                      targetKind="audio"
                      targetId={asset.id}
                      initialFavorite={asset.isFavorite}
                    />
                    <AiSpaceAudioControls
                      className="h-8 min-w-0 flex-1 xl:max-w-md"
                      src={asset.audioUrl}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === asset.id}
                      onClick={() => void askDelete(asset)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AiSpaceConfirmDialog
        request={confirmRequest}
        busy={busyId !== null}
        onCancel={() => setConfirmRequest(null)}
      />
    </div>
  );
}
