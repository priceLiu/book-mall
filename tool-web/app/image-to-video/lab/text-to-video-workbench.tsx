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

/** 示例标签 → 点击填入完整提示词；分组用于「换一组」轮换展示 */
const T2V_EXAMPLE_CHIPS = [
  {
    label: "星萤夏夜",
    prompt:
      "全景，新海诚风格，时间为盛夏的夜晚，地点是远离尘嚣的宁静小镇边缘山坡。晴朗无云，繁星密布如同璀璨宝石镶嵌于天幕，银河横跨天际，散发着幽蓝深邃的光晕。月光如银纱般轻柔地洒在翠绿的山坡草坪上，使其染上一层淡淡的冷白色。一位身着淡蓝色连衣裙的少女静立于此，微风吹拂着及肩的棕色长发，发丝在月光下泛着柔和的暖棕色光泽。她双手交叠放在身前，抬头仰望着星空，眼中满是对浩瀚宇宙的憧憬和淡淡的孤独。周围萤火虫提着绿幽幽的光在草丛中飞舞，像是在安慰少女的寂寞。山坡上五颜六色的野花在星月光辉与萤火虫光亮交织的光影中轻轻摇曳，画面主色调为蓝紫冷色调，点缀着暖黄的萤火虫光与少女裙装的淡蓝。镜头从夜空缓缓向下移动至少女，带着一种静谧又略带忧伤的氛围。",
  },
  {
    label: "云端对话",
    prompt: [
      "【场景】奢华的私人飞机机舱内，窗外是壮丽的金红色的云海落日，阳光将机舱渲染成琥珀色。",
      "【主体】左侧满头银发的 [ 年长男性 ] 身穿高定西装，手持威士忌酒杯，目光如鹰般锐利；右侧的 [ 年轻男性 ] 身体微微前倾，眉头微皱，神情既紧张又充满野心。",
      "【运动】年长男性轻轻晃动着手中的酒杯，液体挂壁，他身体逼近对方；年轻男性深吸一口气，眼神坚定地回视。镜头缓慢侧推，聚焦两人之间紧绷的张力。",
      '【音频】[ 年长男性, 低沉沙哑, 充满威严 ] 说道：“In this world, you either hunt or you become the prey. Which one are you?”',
      '[ 年轻男性, 嗓音紧绷但坚定 ] 回答：“I am the one who pulls the trigger.” 背景伴随着飞机引擎深沉的轰鸣声和冰块撞击玻璃杯的清脆声。',
    ].join("\n"),
  },
  {
    label: "恐龙冲击",
    prompt: "恐龙朝着镜头冲来，画面带有运动模糊，镜头剧烈抖动。",
  },
  {
    label: "古装冷妃",
    prompt:
      "东方古装写实风格，中近景正面视角。一位身着华丽红色绣花礼服的东方古代女子端坐于富丽典雅的宫廷室内，头戴精致繁复的凤冠，珠宝与垂链在灯火下散发高贵威仪；背景朦胧的宫殿装饰营造出庄重的皇家氛围，整体色调以富丽的红金暖色为主。随着镜头环绕，女子神情由端庄肃穆逐渐转为冷厉：眼神微眯透出狠戾寒光，眉尾下压，嘴角单侧上扬呈冷笑状。就在背景纱幔被无形气流掀起、头饰红珠随动作轻晃的瞬间，她阴鸷冷笑：“既然你不识抬举，就休怪本宫心狠。”整个画面在注重服饰绣纹与金属质感刻画的同时，展现出极强的皇家仪式感与暗流涌动的戏剧张力。",
  },
  {
    label: "柠檬成熟",
    prompt:
      "生成一个连续的延时摄影风格视频，展示一颗柠檬树从种子发芽到果实成熟的完整生命周期。要求写实主义自然光照，画面细腻。",
  },
  {
    label: "极限滑雪",
    prompt:
      "高山雪原，阳光明媚的极寒色调，陡峭岩壁，漫天雪雾。身穿橙色冲锋衣的 [ 极限滑雪者 ] 正在极速俯冲，激起飞扬的雪粉，身后是如海啸般倾泻而下的巨大雪崩气浪。雪崩爆发的沉闷轰鸣巨响，背景有滑雪板剧烈切割积雪的摩擦声与急促的风啸声，镜头跟拍高速运动特写，营造生死时速的紧张压迫感。",
  },
] as const;

const EXAMPLE_PROMPT_GROUPS = [
  T2V_EXAMPLE_CHIPS.slice(0, 4),
  T2V_EXAMPLE_CHIPS.slice(4, 6),
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

  const chips =
    EXAMPLE_PROMPT_GROUPS[groupIndex] ?? EXAMPLE_PROMPT_GROUPS[0]!;

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
          {chips.map((item) => (
            <button
              key={`${groupIndex}-${item.label}`}
              type="button"
              className={styles.chip}
              onClick={() => onPromptChange(item.prompt)}
            >
              {item.label}
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
