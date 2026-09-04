"use client";

import { useEffect, useState } from "react";

import {
  OUTFIT_V1_NEGATIVE_PROMPT_ZH,
  buildOutfitShotPrefilledGeneratePrompt,
} from "@/lib/ecom-outfit-video-generate-prompts";
import type { SceneShot } from "@/lib/video-workflow/shot-spine";

type Props = {
  scene: SceneShot | null;
  disabled?: boolean;
  onPromptChange: (sceneId: string, prompt: string) => void;
  onResetPrefill?: (sceneId: string) => void;
};

export function OutfitShotGeneratePromptPanel({
  scene,
  disabled,
  onPromptChange,
  onResetPrefill,
}: Props) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!scene) {
      setDraft("");
      return;
    }
    if (scene.userGeneratePrompt !== undefined && scene.userGeneratePrompt !== null) {
      setDraft(scene.userGeneratePrompt);
      return;
    }
    setDraft(buildOutfitShotPrefilledGeneratePrompt(scene));
  }, [scene?.sceneId, scene?.userGeneratePrompt, scene?.lightingSetup, scene?.sceneBackground, scene?.parseIncomplete]);

  if (!scene) {
    return (
      <div className="rounded-lg border border-dashed border-[#e8e8ed] bg-[#fafafa] px-3 py-4 text-xs text-[#86868b]">
        勾选或点击镜号后，可在此编辑该镜生成 Prompt（系统已预填光影/场景；运镜/动作仅表格展示）。
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[#1d1d1f]">
          片段生成 · 镜 {scene.index}
          {scene.parseIncomplete ? (
            <span className="ml-2 font-normal text-[#ff9500]">识别不足</span>
          ) : null}
        </h3>
        {onResetPrefill ? (
          <button
            type="button"
            className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-40"
            disabled={disabled}
            onClick={() => {
              const prefilled = buildOutfitShotPrefilledGeneratePrompt(scene);
              setDraft(prefilled);
              onResetPrefill(scene.sceneId);
            }}
          >
            恢复系统预填
          </button>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-[#6e6e73]" htmlFor={`outfit-gen-prompt-${scene.sceneId}`}>
          正向 Prompt（可编辑，提交生成时使用）
        </label>
        <textarea
          id={`outfit-gen-prompt-${scene.sceneId}`}
          rows={4}
          disabled={disabled}
          value={draft}
          className="ecom-scrollbar-thin w-full resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 disabled:opacity-60"
          placeholder="可留空（Kling 动作控制将仅依赖参考片段 + 模特图）"
          onChange={(e) => {
            const value = e.target.value;
            setDraft(value);
            onPromptChange(scene.sceneId, value);
          }}
        />
        <p className="text-[10px] leading-relaxed text-[#86868b]">
          运镜、动作不参与拼接；仅基础画质 + 光影/场景（parseIncomplete 时仅基础画质）。生成前/后/再生成均可修改。
        </p>
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-[#6e6e73]">负面 Prompt（只读）</span>
        <pre className="whitespace-pre-wrap rounded-lg border border-[#e8e8ed] bg-white px-3 py-2 text-xs leading-relaxed text-[#6e6e73]">
          {OUTFIT_V1_NEGATIVE_PROMPT_ZH}
        </pre>
      </div>
    </div>
  );
}
