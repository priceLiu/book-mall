"use client";

function RefThumb({ url, label }: { url: string; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label ?? ""} className="h-9 w-9 rounded object-cover ring-1 ring-[#e8e8ed]" />
      {label ? <span className="max-w-[3rem] truncate text-[9px] text-[#6e6e73]">{label}</span> : null}
    </div>
  );
}

export function FilmPullRefReadOnlyCell({
  refs,
  selectedIds,
}: {
  refs: Array<{ id: string; ossUrl: string; label?: string }>;
  selectedIds: string[];
}) {
  const selected = refs.filter((r) => selectedIds.includes(r.id));
  if (selected.length === 0) {
    return <span className="text-[#86868b]">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {selected.map((ref) => (
        <RefThumb key={ref.id} url={ref.ossUrl} label={ref.label} />
      ))}
    </div>
  );
}

/** 编辑态：已选 ref 与预览一致；未选 ref 收在下方「可选」区，避免误以为已绑定 */
export function FilmPullRefToggleCell({
  refs,
  selectedIds,
  disabled,
  onChange,
}: {
  refs: Array<{ id: string; ossUrl: string; label?: string }>;
  selectedIds: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const selected = refs.filter((r) => selectedIds.includes(r.id));
  const available = refs.filter((r) => !selectedIds.includes(r.id));

  return (
    <div className="space-y-1.5">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((ref) => (
            <button
              key={ref.id}
              type="button"
              disabled={disabled}
              title={`${ref.label ?? ref.id} · 点击取消`}
              className="rounded-lg p-0.5 ring-2 ring-[#0071e3] transition"
              onClick={() => onChange(selectedIds.filter((id) => id !== ref.id))}
            >
              <RefThumb url={ref.ossUrl} label={ref.label} />
            </button>
          ))}
        </div>
      ) : (
        <span className="text-[#86868b]">—</span>
      )}
      {available.length > 0 && !disabled ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] text-[#86868b]">可选</span>
          {available.map((ref) => (
            <button
              key={ref.id}
              type="button"
              disabled={disabled}
              title={`添加 ${ref.label ?? ref.id}`}
              className="rounded-lg p-0.5 opacity-50 ring-2 ring-transparent transition hover:opacity-100"
              onClick={() => onChange([...selectedIds, ref.id])}
            >
              <RefThumb url={ref.ossUrl} label={ref.label} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
