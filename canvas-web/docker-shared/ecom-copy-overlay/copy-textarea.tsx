"use client";

export type EcomCopyOverlayMultiLineTextProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** 多行说明（Enter 换行、预览与合成一致） */
  hint?: string;
  rows?: number;
  className?: string;
  labelClassName?: string;
  textareaClassName?: string;
  hintClassName?: string;
};

/** 程序排版 · 图上多行文案输入（海报 / 详情页 / 画布共用） */
export function EcomCopyOverlayMultiLineText({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "Enter 换行；多行将同步到左侧预览与合成成图",
  hint = "支持多行：主标题与副标题分行输入，预览与导出 PNG 按换行排版。",
  rows = 4,
  className = "space-y-2",
  labelClassName = "block text-sm text-[#6e6e73]",
  textareaClassName =
    "mt-1 min-h-[7.5rem] max-h-[min(14rem,32vh)] w-full resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245] whitespace-pre-wrap",
  hintClassName = "text-[11px] leading-relaxed text-[#86868b]",
}: EcomCopyOverlayMultiLineTextProps) {
  return (
    <div className={className}>
      <label className={labelClassName}>
        {label}
        <textarea
          rows={rows}
          className={textareaClassName}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.stopPropagation();
          }}
        />
      </label>
      {hint ? <p className={hintClassName}>{hint}</p> : null}
    </div>
  );
}
