"use client";

import type { ReactNode } from "react";
import type {
  Pro2ProductionScript,
  Pro2ProductionScriptPatchBody,
} from "@/lib/canvas/data/pro2-production-script-schema";
import { PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION } from "@/lib/canvas/data/pro2-production-script-schema";
import { Pro2ColorBlockPicker, type Pro2ColorBlockValue } from "./pro2-color-block-picker";

const INPUT =
  "nodrag w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-800";
const TEXTAREA =
  "nodrag w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-800";

function toScriptColorBlock(
  value: Pro2ColorBlockValue,
): NonNullable<Pro2ProductionScriptPatchBody["scenes"]>[number]["colorBlock"] {
  const primary = value.primary?.trim();
  if (!primary) return undefined;
  return {
    primary,
    secondary: value.secondary,
    highlight: value.highlight,
    shadow: value.shadow,
    notes: value.notes,
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-[13px] font-semibold text-neutral-800">{title}</h3>
      {children}
    </section>
  );
}

function emptyScript(): Pro2ProductionScript {
  return {
    schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    visualStyle: {
      worldBackground: "",
      era: "",
    },
    scenes: [],
    characters: [],
    shots: [],
    coreConflict: [],
    handoff: [],
  };
}

export function normalizeHubProductionScript(
  script?: Pro2ProductionScript | null,
): Pro2ProductionScript {
  if (!script) return emptyScript();
  return {
    ...emptyScript(),
    ...script,
    schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
  };
}

export function Pro2ProductionScriptEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: Pro2ProductionScript;
  onChange: (next: Pro2ProductionScript) => void;
  readOnly?: boolean;
}) {
  const patch = (partial: Pro2ProductionScriptPatchBody) => {
    onChange({
      ...value,
      ...partial,
      schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    });
  };

  const vs = value.visualStyle ?? {};

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-8">
      <Section title="视觉风格总纲">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] text-neutral-500">故事背景</span>
            <textarea
              className={TEXTAREA}
              rows={2}
              disabled={readOnly}
              value={vs.worldBackground ?? ""}
              onChange={(e) =>
                patch({ visualStyle: { ...vs, worldBackground: e.target.value } })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-500">年代/环境</span>
            <input
              className={INPUT}
              disabled={readOnly}
              value={vs.era ?? ""}
              onChange={(e) =>
                patch({ visualStyle: { ...vs, era: e.target.value } })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-500">全剧色调</span>
            <input
              className={INPUT}
              disabled={readOnly}
              value={vs.globalColorTone ?? ""}
              onChange={(e) =>
                patch({ visualStyle: { ...vs, globalColorTone: e.target.value } })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-500">画面风格</span>
            <input
              className={INPUT}
              disabled={readOnly}
              value={vs.pictureStyle ?? ""}
              onChange={(e) =>
                patch({ visualStyle: { ...vs, pictureStyle: e.target.value } })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-500">摄影风格</span>
            <input
              className={INPUT}
              disabled={readOnly}
              value={vs.cinematography ?? ""}
              onChange={(e) =>
                patch({ visualStyle: { ...vs, cinematography: e.target.value } })
              }
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] text-neutral-500">日景调色板</p>
            <Pro2ColorBlockPicker
              showSecondary={false}
              disabled={readOnly}
              value={vs.dayPalette}
              onChange={(dayPalette) =>
                patch({ visualStyle: { ...vs, dayPalette } })
              }
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] text-neutral-500">夜景调色板</p>
            <Pro2ColorBlockPicker
              showSecondary={false}
              disabled={readOnly}
              value={vs.nightPalette}
              onChange={(nightPalette) =>
                patch({ visualStyle: { ...vs, nightPalette } })
              }
            />
          </div>
        </div>
      </Section>

      <Section title={`场景 (${value.scenes?.length ?? 0})`}>
        {(value.scenes ?? []).map((scene, i) => (
          <div
            key={scene.id || i}
            className="mb-4 border-b border-neutral-100 pb-4 last:mb-0 last:border-0 last:pb-0"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={INPUT}
                disabled={readOnly}
                placeholder="场景名"
                value={scene.name}
                onChange={(e) => {
                  const scenes = [...(value.scenes ?? [])];
                  scenes[i] = { ...scene, name: e.target.value };
                  patch({ scenes });
                }}
              />
              <input
                className={INPUT}
                disabled={readOnly}
                placeholder="环境/时间/气氛"
                value={scene.environmentTimeMood}
                onChange={(e) => {
                  const scenes = [...(value.scenes ?? [])];
                  scenes[i] = { ...scene, environmentTimeMood: e.target.value };
                  patch({ scenes });
                }}
              />
            </div>
            <textarea
              className={`${TEXTAREA} mt-2`}
              rows={2}
              disabled={readOnly}
              placeholder="生图关键词"
              value={scene.imagePrompt}
              onChange={(e) => {
                const scenes = [...(value.scenes ?? [])];
                scenes[i] = { ...scene, imagePrompt: e.target.value };
                patch({ scenes });
              }}
            />
            <div className="mt-2">
              <Pro2ColorBlockPicker
                disabled={readOnly}
                showNotes
                value={scene.colorBlock}
                onChange={(colorBlock) => {
                  const scenes = [...(value.scenes ?? [])];
                  scenes[i] = { ...scene, colorBlock: toScriptColorBlock(colorBlock) };
                  patch({ scenes });
                }}
              />
            </div>
          </div>
        ))}
        {(value.scenes?.length ?? 0) === 0 ? (
          <p className="text-[11px] text-neutral-500">暂无场景 · 请先生成剧本</p>
        ) : null}
      </Section>

      <Section title={`角色 (${value.characters?.length ?? 0})`}>
        {(value.characters ?? []).map((char, i) => (
          <div key={char.id || i} className="mb-3 grid gap-2 sm:grid-cols-2">
            <input
              className={INPUT}
              disabled={readOnly}
              placeholder="姓名"
              value={char.name}
              onChange={(e) => {
                const characters = [...(value.characters ?? [])];
                characters[i] = { ...char, name: e.target.value };
                patch({ characters });
              }}
            />
            <input
              className={INPUT}
              disabled={readOnly}
              placeholder="身份"
              value={char.role}
              onChange={(e) => {
                const characters = [...(value.characters ?? [])];
                characters[i] = { ...char, role: e.target.value };
                patch({ characters });
              }}
            />
            <textarea
              className={`${TEXTAREA} sm:col-span-2`}
              rows={2}
              disabled={readOnly}
              placeholder="外貌/服装"
              value={char.appearance}
              onChange={(e) => {
                const characters = [...(value.characters ?? [])];
                characters[i] = { ...char, appearance: e.target.value };
                patch({ characters });
              }}
            />
          </div>
        ))}
      </Section>

      <Section title={`分镜 (${value.shots?.length ?? 0})`}>
        {(value.shots ?? []).map((shot, i) => (
          <div
            key={shot.index ?? i}
            className="mb-4 border-b border-neutral-100 pb-4 last:mb-0 last:border-0"
          >
            <p className="mb-2 text-[11px] font-semibold text-neutral-700">
              镜 {shot.index}
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              <input
                className={INPUT}
                disabled={readOnly}
                placeholder="景别"
                value={shot.shotSize ?? ""}
                onChange={(e) => {
                  const shots = [...(value.shots ?? [])];
                  shots[i] = { ...shot, shotSize: e.target.value };
                  patch({ shots });
                }}
              />
              <input
                className={INPUT}
                disabled={readOnly}
                placeholder="运镜"
                value={shot.cameraMove ?? ""}
                onChange={(e) => {
                  const shots = [...(value.shots ?? [])];
                  shots[i] = { ...shot, cameraMove: e.target.value };
                  patch({ shots });
                }}
              />
              <input
                className={INPUT}
                disabled={readOnly}
                placeholder="时长(秒)"
                type="number"
                value={shot.durationSec ?? ""}
                onChange={(e) => {
                  const shots = [...(value.shots ?? [])];
                  const n = parseInt(e.target.value, 10);
                  shots[i] = {
                    ...shot,
                    durationSec: Number.isFinite(n) ? n : undefined,
                  };
                  patch({ shots });
                }}
              />
            </div>
            <textarea
              className={`${TEXTAREA} mt-2`}
              rows={2}
              disabled={readOnly}
              placeholder="画面描述"
              value={shot.sceneDescription}
              onChange={(e) => {
                const shots = [...(value.shots ?? [])];
                shots[i] = { ...shot, sceneDescription: e.target.value };
                patch({ shots });
              }}
            />
            <div className="mt-2">
              <Pro2ColorBlockPicker
                disabled={readOnly}
                showNotes
                value={shot.colorBlock}
                onChange={(colorBlock) => {
                  const shots = [...(value.shots ?? [])];
                  shots[i] = { ...shot, colorBlock: toScriptColorBlock(colorBlock) };
                  patch({ shots });
                }}
              />
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
