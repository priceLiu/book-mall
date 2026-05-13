"use client";

/**
 * 文生视频 · 工作台 UI（样式见 ./text-to-video-workbench.module.css，与实验室其它模式隔离）
 */

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  T2V_ASPECT_RATIO_OPTIONS,
  type T2vAspectRatio,
} from "@/lib/image-to-video-models";
import { cn } from "@/lib/utils";
import styles from "./text-to-video-workbench.module.css";

/** 示例文案分组：刷新在组间轮换 */
const EXAMPLE_PROMPT_GROUPS = [
  ["星萤夏夜", "云端对话", "恐龙冲击", "古装冷妃"],
  ["柠檬成熟", "极限滑雪"],
] as const;

export type TextToVideoWorkbenchProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  resolution: "720P" | "1080P";
  onResolutionChange: (value: "720P" | "1080P") => void;
  aspectRatio: T2vAspectRatio;
  onAspectRatioChange: (value: T2vAspectRatio) => void;
  className?: string;
};

export function TextToVideoWorkbench({
  prompt,
  onPromptChange,
  resolution,
  onResolutionChange,
  aspectRatio,
  onAspectRatioChange,
  className,
}: TextToVideoWorkbenchProps) {
  const [groupIndex, setGroupIndex] = useState(0);

  const cycleGroup = useCallback(() => {
    setGroupIndex((i) => (i + 1) % EXAMPLE_PROMPT_GROUPS.length);
  }, []);

  const chips = EXAMPLE_PROMPT_GROUPS[groupIndex] ?? EXAMPLE_PROMPT_GROUPS[0];

  return (
    <div className={cn(styles.root, className)}>
      <div className="space-y-1.5">
        <label className={styles.promptLabel} htmlFor="t2v-workbench-prompt">
          提示词 <span className="text-destructive">*</span>
        </label>
        <textarea
          id="t2v-workbench-prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={5}
          className={styles.textarea}
          placeholder="请输入"
        />
      </div>

      <div className={styles.exampleBox}>
        <div className={styles.exampleHeader}>
          <span className={styles.exampleTitle}>示例 Prompt</span>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={cycleGroup}
            aria-label="换一组示例 Prompt"
            title="换一组"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className={styles.chips}>
          {chips.map((label) => (
            <button
              key={`${groupIndex}-${label}`}
              type="button"
              className={styles.chip}
              onClick={() => onPromptChange(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className={styles.sectionLabel}>清晰度</span>
        <div className={styles.toggleRow}>
          {(["720P", "1080P"] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={cn(
                styles.toggleBtn,
                resolution === r ? styles.toggleBtnActive : undefined,
              )}
              onClick={() => onResolutionChange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className={styles.sectionLabel}>宽高比</span>
        <div className={styles.aspectGrid}>
          {T2V_ASPECT_RATIO_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={cn(
                styles.aspectBtn,
                aspectRatio === r ? styles.aspectBtnActive : undefined,
              )}
              onClick={() => onAspectRatioChange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
