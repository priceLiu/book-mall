"use client";

import {
  AI_SPACE_TTS_EMOTION_OPTIONS,
  AI_SPACE_TTS_VOICE_CONTROL_DEFAULTS,
  type AiSpaceTtsVoiceControls,
} from "@/lib/ai-space/ai-space-tts-voice-controls";

function ControlSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5 text-xs text-[#656d76]">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums text-[#1f2328]">{value.toFixed(step >= 1 ? 0 : 2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[#0969da]"
      />
      <span className="block text-[11px] text-[#8c959f]">{hint}</span>
    </label>
  );
}

export function AiSpaceTtsVoiceControlsPanel({
  variant,
  controls,
  instruction,
  onControlsChange,
  onInstructionChange,
}: {
  variant: "minimax" | "bailian";
  controls: AiSpaceTtsVoiceControls;
  instruction: string;
  onControlsChange: (next: AiSpaceTtsVoiceControls) => void;
  onInstructionChange: (next: string) => void;
}) {
  const patch = (partial: Partial<AiSpaceTtsVoiceControls>) =>
    onControlsChange({ ...controls, ...partial });

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-[#d0d7de] bg-[#fafbfc] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#1f2328]">语气与语音参数</p>
        <button
          type="button"
          className="text-xs text-[#0969da] hover:underline"
          onClick={() => onControlsChange({ ...AI_SPACE_TTS_VOICE_CONTROL_DEFAULTS })}
        >
          恢复默认
        </button>
      </div>

      {variant === "minimax" ? (
        <label className="block space-y-1 text-xs text-[#656d76]">
          <span>情绪</span>
          <select
            className="h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
            value={controls.emotion ?? ""}
            onChange={(e) => patch({ emotion: e.target.value || null })}
          >
            {AI_SPACE_TTS_EMOTION_OPTIONS.map((opt) => (
              <option key={opt.id || "default"} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block space-y-1 text-xs text-[#656d76]">
          <span>语气 / 情感指令</span>
          <input
            className="h-9 w-full rounded-md border border-[#d0d7de] bg-white px-2 text-sm text-[#1f2328]"
            maxLength={100}
            placeholder="如：语速稍快，语气亲切、带一点兴奋"
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
          />
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <ControlSlider
          label="语速"
          hint="偏慢 ← → 偏快"
          value={controls.speed}
          min={0.5}
          max={2}
          step={0.01}
          onChange={(speed) => patch({ speed })}
        />
        <ControlSlider
          label="音量"
          hint="偏轻 ← → 偏响"
          value={controls.volume}
          min={0}
          max={2}
          step={0.01}
          onChange={(volume) => patch({ volume })}
        />
        <ControlSlider
          label="音调"
          hint="偏低 ← → 偏高"
          value={controls.pitch}
          min={-12}
          max={12}
          step={1}
          onChange={(pitch) => patch({ pitch })}
        />
      </div>
    </div>
  );
}
