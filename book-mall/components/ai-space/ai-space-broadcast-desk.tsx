"use client";

import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiSpaceDigitalHumanDto } from "@/lib/ai-space/ai-space-digital-human-types";
import type {
  BroadcastProjectDto,
  BroadcastShotDto,
} from "@/lib/ai-space/ai-space-broadcast-types";
import {
  AI_SPACE_S2V_MAX_AUDIO_SEC,
  formatShotTimeRange,
} from "@/lib/ai-space/ai-space-broadcast-types";
import type { AiSpaceVideoMaterialDto } from "@/lib/ai-space/ai-space-video-types";

const PROJECTS_API = "/api/platform/v1/ai-space/broadcast-projects";
const SHOTS_API = "/api/platform/v1/ai-space/broadcast-shots";

export function AiSpaceBroadcastDesk({
  initialProjects,
  digitalHumans,
  backgrounds,
}: {
  initialProjects: BroadcastProjectDto[];
  digitalHumans: AiSpaceDigitalHumanDto[];
  backgrounds: AiSpaceVideoMaterialDto[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [projectId, setProjectId] = useState(initialProjects[0]?.id ?? "");
  const [sourceText, setSourceText] = useState(
    initialProjects[0]?.sourceText ?? "",
  );
  const [targetDurationSec, setTargetDurationSec] = useState(
    initialProjects[0]?.targetDurationSec ?? 45,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );
  const shots = project?.activeScript?.shots ?? [];
  const totalSec = shots.reduce((s, row) => s + row.durationSec, 0);
  const locked = project?.status === "locked" || project?.status === "done";
  const warnings = shots.flatMap((s) => {
    const list: string[] = [];
    if (s.validation.audioTooLong) {
      list.push(`镜 ${s.index} 口播 ≥ ${AI_SPACE_S2V_MAX_AUDIO_SEC}s`);
    }
    if (s.validation.missingDigitalHuman && s.presenter.enabled) {
      list.push(`镜 ${s.index} 缺数字人形象`);
    }
    if (s.validation.missingBackground && s.visual.type === "video") {
      list.push(`镜 ${s.index} 缺背景视频`);
    }
    return list;
  });

  const applyProject = useCallback((p: BroadcastProjectDto) => {
    setProjects((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx < 0) return [p, ...prev];
      const next = [...prev];
      next[idx] = p;
      return next;
    });
    setProjectId(p.id);
    setSourceText(p.sourceText ?? "");
    setTargetDurationSec(p.targetDurationSec ?? 45);
  }, []);

  const createProject = useCallback(async () => {
    setError(null);
    setBusy("create");
    try {
      const res = await fetch(PROJECTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: "口播项目",
          sourceText,
          targetDurationSec,
          aspectRatio: "9:16",
        }),
      });
      const data = (await res.json()) as {
        project?: BroadcastProjectDto;
        error?: string;
      };
      if (!res.ok || !data.project) {
        setError(data.error ?? "创建失败");
        return;
      }
      applyProject(data.project);
      setNotice("已创建项目");
    } finally {
      setBusy(null);
    }
  }, [applyProject, sourceText, targetDurationSec]);

  const saveBrief = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    setBusy("save");
    try {
      const res = await fetch(`${PROJECTS_API}?id=${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceText, targetDurationSec }),
      });
      const data = (await res.json()) as {
        project?: BroadcastProjectDto;
        error?: string;
      };
      if (!res.ok || !data.project) {
        setError(data.error ?? "保存失败");
        return;
      }
      applyProject(data.project);
      setNotice("已保存");
    } finally {
      setBusy(null);
    }
  }, [applyProject, projectId, sourceText, targetDurationSec]);

  const splitScript = useCallback(async () => {
    setError(null);
    setBusy("split");
    try {
      let id = projectId;
      if (!id) {
        const createRes = await fetch(PROJECTS_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: "口播项目",
            sourceText,
            targetDurationSec,
            aspectRatio: "9:16",
          }),
        });
        const createData = (await createRes.json()) as {
          project?: BroadcastProjectDto;
          error?: string;
        };
        if (!createRes.ok || !createData.project) {
          setError(createData.error ?? "创建失败");
          return;
        }
        applyProject(createData.project);
        id = createData.project.id;
      } else {
        await saveBrief();
      }
      const res = await fetch(
        `${PROJECTS_API}/split?id=${encodeURIComponent(id)}`,
        { method: "POST", credentials: "include" },
      );
      const data = (await res.json()) as {
        project?: BroadcastProjectDto;
        error?: string;
      };
      if (!res.ok || !data.project) {
        setError(data.error ?? "AI 拆镜失败");
        return;
      }
      applyProject(data.project);
      setNotice("拆镜完成，请在表格中补充素材");
    } finally {
      setBusy(null);
    }
  }, [applyProject, projectId, saveBrief, sourceText, targetDurationSec]);

  const patchShot = useCallback(
    async (shotId: string, body: Record<string, unknown>) => {
      const res = await fetch(`${SHOTS_API}?id=${encodeURIComponent(shotId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { shot?: BroadcastShotDto; error?: string };
      if (!res.ok || !data.shot) {
        throw new Error(data.error ?? "更新分镜失败");
      }
      return data.shot;
    },
    [],
  );

  const refreshProject = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`${PROJECTS_API}?id=${encodeURIComponent(projectId)}`, {
      credentials: "include",
    });
    const data = (await res.json()) as { project?: BroadcastProjectDto };
    if (data.project) applyProject(data.project);
  }, [applyProject, projectId]);

  const lockScript = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    setBusy("lock");
    try {
      const res = await fetch(
        `${PROJECTS_API}/lock?id=${encodeURIComponent(projectId)}`,
        { method: "POST", credentials: "include" },
      );
      const data = (await res.json()) as {
        project?: BroadcastProjectDto;
        error?: string;
      };
      if (!res.ok || !data.project) {
        setError(data.error ?? "锁定失败");
        return;
      }
      applyProject(data.project);
      setNotice("脚本已锁定，可开始合成");
    } finally {
      setBusy(null);
    }
  }, [applyProject, projectId]);

  const renderProject = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    setBusy("render");
    try {
      const res = await fetch(
        `${PROJECTS_API}/render?id=${encodeURIComponent(projectId)}`,
        { method: "POST", credentials: "include" },
      );
      const data = (await res.json()) as {
        project?: BroadcastProjectDto;
        error?: string;
      };
      if (!res.ok || !data.project) {
        setError(data.error ?? "合成失败");
        return;
      }
      applyProject(data.project);
      setNotice("口播成片已生成，可在视频创作库查看");
    } finally {
      setBusy(null);
    }
  }, [applyProject, projectId]);

  const ttsShot = useCallback(
    async (shotId: string) => {
      setError(null);
      setBusy(`tts-${shotId}`);
      try {
        const res = await fetch(
          `${SHOTS_API}/tts?id=${encodeURIComponent(shotId)}`,
          { method: "POST", credentials: "include" },
        );
        const data = (await res.json()) as {
          project?: BroadcastProjectDto;
          error?: string;
        };
        if (!res.ok || !data.project) {
          setError(data.error ?? "TTS 失败");
          return;
        }
        applyProject(data.project);
      } finally {
        setBusy(null);
      }
    },
    [applyProject],
  );

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-[#1a7f37]">{notice}</p> : null}

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1 space-y-1 text-xs text-[#656d76]">
            <span>项目</span>
            <select
              className="h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm"
              value={projectId}
              onChange={(e) => {
                const id = e.target.value;
                setProjectId(id);
                const p = projects.find((x) => x.id === id);
                if (p) {
                  setSourceText(p.sourceText ?? "");
                  setTargetDurationSec(p.targetDurationSec ?? 45);
                }
              }}
            >
              <option value="">请选择或新建</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}（{p.status}）
                </option>
              ))}
            </select>
          </label>
          <label className="w-28 space-y-1 text-xs text-[#656d76]">
            <span>目标时长（秒）</span>
            <input
              type="number"
              min={10}
              max={600}
              className="h-9 w-full rounded-md border border-[#d0d7de] px-2 text-sm"
              value={targetDurationSec}
              disabled={locked}
              onChange={(e) => setTargetDurationSec(Number(e.target.value) || 45)}
            />
          </label>
          <Button type="button" variant="outline" disabled={!!busy} onClick={() => void createProject()}>
            新建项目
          </Button>
        </div>

        <label className="mt-4 block space-y-1 text-xs text-[#656d76]">
          <span>整段口播文案</span>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-[#d0d7de] px-3 py-2 text-sm text-[#1f2328]"
            value={sourceText}
            disabled={locked}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="粘贴完整口播稿，AI 将拆成多镜…"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!!busy || locked || !sourceText.trim()}
            onClick={() => void splitScript()}
          >
            {busy === "split" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            AI 拆镜
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!busy || locked || !projectId}
            onClick={() => void saveBrief()}
          >
            保存草稿
          </Button>
        </div>
      </section>

      {shots.length > 0 ? (
        <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#656d76]">
            <span>
              累计 {Math.round(totalSec * 10) / 10}s
              {project?.targetDurationSec
                ? ` / 目标 ${project.targetDurationSec}s`
                : ""}
            </span>
            {warnings.length > 0 ? (
              <span className="text-destructive">{warnings.join(" · ")}</span>
            ) : (
              <span className="text-[#1a7f37]">校验通过</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#eaeef2] text-[#656d76]">
                  <th className="px-2 py-2">镜号</th>
                  <th className="px-2 py-2">时间</th>
                  <th className="px-2 py-2">口播文案</th>
                  <th className="px-2 py-2">画面描述</th>
                  <th className="px-2 py-2">背景视频</th>
                  <th className="px-2 py-2">数字人</th>
                  <th className="px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {shots.map((shot) => (
                  <tr key={shot.id} className="border-b border-[#eaeef2] align-top">
                    <td className="px-2 py-2">{shot.index}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-[#656d76]">
                      {formatShotTimeRange(shot.startSec, shot.endSec)}
                      <div>{shot.durationSec.toFixed(1)}s</div>
                    </td>
                    <td className="px-2 py-2">
                      <textarea
                        className="min-h-[64px] w-full rounded border border-[#d0d7de] px-2 py-1 text-xs"
                        defaultValue={shot.voiceoverText}
                        disabled={locked}
                        onBlur={(e) => {
                          if (e.target.value === shot.voiceoverText) return;
                          void patchShot(shot.id, { voiceoverText: e.target.value })
                            .then(() => refreshProject())
                            .catch((err) =>
                              setError(err instanceof Error ? err.message : "更新失败"),
                            );
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <textarea
                        className="min-h-[64px] w-full rounded border border-[#d0d7de] px-2 py-1 text-xs"
                        defaultValue={shot.sceneDescription}
                        disabled={locked}
                        onBlur={(e) => {
                          if (e.target.value === shot.sceneDescription) return;
                          void patchShot(shot.id, {
                            sceneDescription: e.target.value,
                          })
                            .then(() => refreshProject())
                            .catch((err) =>
                              setError(err instanceof Error ? err.message : "更新失败"),
                            );
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="h-8 w-full max-w-[140px] rounded border border-[#d0d7de] px-1"
                        value={shot.backgroundVideoId ?? ""}
                        disabled={locked}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          void patchShot(shot.id, { backgroundVideoId: v })
                            .then(() => refreshProject())
                            .catch((err) =>
                              setError(err instanceof Error ? err.message : "更新失败"),
                            );
                        }}
                      >
                        <option value="">未选择</option>
                        {backgrounds.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={shot.presenter.enabled}
                          disabled={locked}
                          onChange={(e) => {
                            void patchShot(shot.id, {
                              presenter: { enabled: e.target.checked },
                            })
                              .then(() => refreshProject())
                              .catch((err) =>
                                setError(err instanceof Error ? err.message : "更新失败"),
                              );
                          }}
                        />
                        出镜
                      </label>
                      {shot.presenter.enabled ? (
                        <>
                          <select
                            className="mt-1 h-8 w-full max-w-[120px] rounded border border-[#d0d7de] px-1"
                            value={shot.digitalHumanId ?? ""}
                            disabled={locked}
                            onChange={(e) => {
                              void patchShot(shot.id, {
                                digitalHumanId: e.target.value || null,
                                presenter: { digitalHumanId: e.target.value || undefined },
                              })
                                .then(() => refreshProject())
                                .catch((err) =>
                                  setError(err instanceof Error ? err.message : "更新失败"),
                                );
                            }}
                          >
                            <option value="">选形象</option>
                            {digitalHumans.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-[#656d76]">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              className="w-12 rounded border border-[#d0d7de] px-1"
                              defaultValue={shot.presenter.appearFromSec}
                              disabled={locked}
                              title="出镜起始（秒）"
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isFinite(v) || v === shot.presenter.appearFromSec) return;
                                void patchShot(shot.id, {
                                  presenter: { appearFromSec: v },
                                })
                                  .then(() => refreshProject())
                                  .catch((err) =>
                                    setError(err instanceof Error ? err.message : "更新失败"),
                                  );
                              }}
                            />
                            <span>–</span>
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              className="w-12 rounded border border-[#d0d7de] px-1"
                              defaultValue={
                                shot.presenter.appearToSec ?? shot.durationSec
                              }
                              disabled={locked}
                              title="出镜结束（秒，留空=镜末）"
                              onBlur={(e) => {
                                const raw = e.target.value.trim();
                                const v = raw === "" ? null : Number(raw);
                                if (v !== null && !Number.isFinite(v)) return;
                                if (v === shot.presenter.appearToSec) return;
                                void patchShot(shot.id, {
                                  presenter: { appearToSec: v },
                                })
                                  .then(() => refreshProject())
                                  .catch((err) =>
                                    setError(err instanceof Error ? err.message : "更新失败"),
                                  );
                              }}
                            />
                            <span>s</span>
                          </div>
                        </>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!!busy || locked}
                        onClick={() => void ttsShot(shot.id)}
                      >
                        {busy === `tts-${shot.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "TTS"
                        )}
                      </Button>
                      <div className="mt-1 text-[#8c959f]">{shot.shotStatus}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!!busy || locked || warnings.length > 0}
              onClick={() => void lockScript()}
            >
              {busy === "lock" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              锁定脚本
            </Button>
            <Button
              type="button"
              disabled={!!busy || project?.status !== "locked"}
              onClick={() => void renderProject()}
            >
              {busy === "render" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              从脚本合成
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
