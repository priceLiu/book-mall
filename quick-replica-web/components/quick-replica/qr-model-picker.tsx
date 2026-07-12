"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  ImageIcon,
  Languages,
  Layers,
  Mic,
  Music2,
  Search,
  Sparkles,
  UserRound,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { QrModal } from "@/components/quick-replica/qr-modal";
import type { QrModelBadge, QrModelFeatureId, QrModelPickerEntry } from "@/lib/qr-model-picker-types";
import { qrModelFeatureLabel, qrModelPickerRowFeatures } from "@/lib/qr-model-picker-types";

const FEATURE_TAG_CLASS =
  "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap text-[10px] leading-none text-[var(--qr-text-secondary)]";

const SPEC_TAG_CLASS =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-white/10 bg-white/[0.03] px-2 text-[11px] leading-none text-[var(--qr-text-muted)]";

export type QrModelPickerFilterOptions = {
  providerOptions?: readonly (readonly [string, string])[];
  categoryOptions?: readonly (readonly [string, string])[];
  featureOptions?: readonly { id: QrModelFeatureId; label: string }[];
};

type Props = {
  open: boolean;
  title?: string;
  selectedModelKey: string;
  catalog: QrModelPickerEntry[];
  filterOptions?: QrModelPickerFilterOptions;
  showRecommended?: boolean;
  onSelect: (modelKey: string) => void;
  onClose: () => void;
};

function FeatureIcon({ feature }: { feature: QrModelFeatureId }) {
  const className = "h-3.5 w-3.5 shrink-0 opacity-80";
  switch (feature) {
    case "reference":
      return <ImageIcon className={className} />;
    case "start-end":
      return <Film className={className} />;
    case "start-frame":
      return <Clapperboard className={className} />;
    case "audio":
      return <Volume2 className={className} />;
    case "multi-shots":
      return <Layers className={className} />;
    case "motion-control":
      return <Film className={className} />;
    case "character-ref":
      return <UserRound className={className} />;
    case "text-to-image":
    case "text-to-speech":
      return <Sparkles className={className} />;
    case "image-to-image":
      return <ImageIcon className={className} />;
    case "voice-clone":
      return <Mic className={className} />;
    case "voice-change":
      return <Wand2 className={className} />;
    case "sfx":
      return <Volume2 className={className} />;
    case "music":
      return <Music2 className={className} />;
    case "multi-lang":
      return <Languages className={className} />;
    case "hd":
      return <Sparkles className={className} />;
    default:
      return null;
  }
}

function ModelBadge({ badge }: { badge: QrModelBadge }) {
  const styles =
    badge === "new"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : "bg-pink-500/20 text-pink-300 border-pink-500/30";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${styles}`}
    >
      {badge === "new" ? "New" : "Fast"}
    </span>
  );
}

function ProviderIcon({ entry }: { entry: QrModelPickerEntry }) {
  const lightIcon = entry.iconBg === "#f3f4f6";
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
        lightIcon ? "text-gray-900" : "text-white"
      }`}
      style={{ background: entry.iconBg }}
    >
      {entry.iconLetter}
    </span>
  );
}

function ModelTagRows({ entry }: { entry: QrModelPickerEntry }) {
  const features = qrModelPickerRowFeatures(entry);
  return (
    <div className="flex w-full shrink-0 flex-col items-end gap-1 sm:w-[38%] sm:min-w-[300px]">
      {features.length > 0 ? (
        <div className="flex max-w-full flex-nowrap items-center justify-end gap-x-1.5 overflow-x-auto hide-scrollbar">
          {features.map((feature) => (
            <span key={feature} className={FEATURE_TAG_CLASS}>
              <FeatureIcon feature={feature} />
              {qrModelFeatureLabel(feature)}
            </span>
          ))}
        </div>
      ) : null}
      {entry.specTags.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {entry.specTags.map((tag) => (
            <span key={tag} className={SPEC_TAG_CLASS}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RecommendedCard({
  entry,
  selected,
  onSelect,
}: {
  entry: QrModelPickerEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative h-[132px] w-[220px] shrink-0 overflow-hidden rounded-2xl border text-left transition ${
        selected
          ? "border-[var(--qr-brand)] ring-2 ring-[var(--qr-brand)]/30"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <div
        className="absolute inset-0"
        style={{ background: entry.heroGradient ?? "linear-gradient(135deg, #1f2731, #252d38)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-sm font-semibold text-white">{entry.label}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/70">
          {entry.description}
        </p>
      </div>
    </button>
  );
}

function ModelRow({
  entry,
  selected,
  onSelect,
}: {
  entry: QrModelPickerEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col gap-2.5 rounded-xl px-3 py-3.5 text-left transition sm:flex-row sm:items-center sm:gap-4 ${
        selected ? "bg-[rgba(59,130,246,0.14)]" : "hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3 sm:w-2/3 sm:flex-[2]">
        <ProviderIcon entry={entry} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--qr-text-primary)]">
              {entry.label}
            </span>
            {(entry.badges ?? []).map((badge) => (
              <ModelBadge key={badge} badge={badge} />
            ))}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-[var(--qr-text-muted)]">
            {entry.description}
          </span>
        </span>
      </div>
      <ModelTagRows entry={entry} />
    </button>
  );
}

export function QrModelPickerTrigger({
  entry,
  busy,
  onOpen,
  label = "模型",
  subtitle,
}: {
  entry: QrModelPickerEntry;
  busy?: boolean;
  onOpen: () => void;
  label?: string;
  subtitle?: string;
}) {
  const lightIcon = entry.iconBg === "#f3f4f6";
  const specHint = entry.specTags.join(" · ");
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={busy}
      className="qr-card flex w-full items-center gap-3 p-4 text-left disabled:opacity-60"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
          lightIcon ? "text-gray-900" : "text-white"
        }`}
        style={{ background: entry.iconBg }}
      >
        {entry.iconLetter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-[var(--qr-text-muted)]">{label}</span>
        <span className="block text-sm font-medium text-[var(--qr-text-primary)]">{entry.label}</span>
        <span className="block text-xs text-[var(--qr-text-secondary)]">
          {subtitle ?? specHint}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--qr-text-muted)]" />
    </button>
  );
}

export function QrModelPicker({
  open,
  title = "模型",
  selectedModelKey,
  catalog,
  filterOptions,
  showRecommended = true,
  onSelect,
  onClose,
}: Props) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [providerFilter, setProviderFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [search, setSearch] = useState("");

  const recommended = useMemo(
    () => (showRecommended ? catalog.filter((m) => m.recommended) : []),
    [catalog, showRecommended],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((m) => {
      if (providerFilter !== "all" && m.provider !== providerFilter) return false;
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      if (
        featureFilter !== "all" &&
        !m.filterFeatureIds.includes(featureFilter as QrModelFeatureId)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        (m.providerLabel ?? "").toLowerCase().includes(q) ||
        (m.categoryLabel ?? "").toLowerCase().includes(q)
      );
    });
  }, [catalog, categoryFilter, featureFilter, providerFilter, search]);

  const scrollCarousel = (dir: -1 | 1) => {
    carouselRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  const pick = (modelKey: string) => {
    onSelect(modelKey);
    onClose();
  };

  const hasFilters =
    (filterOptions?.providerOptions?.length ?? 0) > 0 ||
    (filterOptions?.categoryOptions?.length ?? 0) > 0 ||
    (filterOptions?.featureOptions?.length ?? 0) > 0;

  return (
    <QrModal open={open} onClose={onClose} variant="model-picker" title={title}>
      <div className="flex min-h-0 flex-1 flex-col">
        {recommended.length > 0 ? (
          <div className="shrink-0 border-b border-[var(--qr-border)] px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--qr-text-secondary)]">推荐</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => scrollCarousel(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[var(--qr-text-muted)] transition hover:bg-white/5"
                  aria-label="上一组"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[var(--qr-text-muted)] transition hover:bg-white/5"
                  aria-label="下一组"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div ref={carouselRef} className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
              {recommended.map((entry) => (
                <RecommendedCard
                  key={entry.modelKey}
                  entry={entry}
                  selected={selectedModelKey === entry.modelKey}
                  onSelect={() => pick(entry.modelKey)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {hasFilters ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--qr-border)] px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setProviderFilter("all");
                setCategoryFilter("all");
                setFeatureFilter("all");
                setSearch("");
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                providerFilter === "all" &&
                categoryFilter === "all" &&
                featureFilter === "all" &&
                !search
                  ? "bg-white text-black"
                  : "border border-white/10 text-[var(--qr-text-secondary)] hover:bg-white/5"
              }`}
            >
              全部模型
            </button>

            {(filterOptions?.providerOptions?.length ?? 0) > 0 ? (
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="qr-input max-w-[140px] py-1.5 text-xs"
                aria-label="厂商筛选"
              >
                <option value="all">全部厂商</option>
                {filterOptions!.providerOptions!.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            ) : null}

            {(filterOptions?.categoryOptions?.length ?? 0) > 0 ? (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="qr-input max-w-[140px] py-1.5 text-xs"
                aria-label="类别筛选"
              >
                <option value="all">全部类别</option>
                {filterOptions!.categoryOptions!.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            ) : null}

            {(filterOptions?.featureOptions?.length ?? 0) > 0 ? (
              <select
                value={featureFilter}
                onChange={(e) => setFeatureFilter(e.target.value)}
                className="qr-input max-w-[140px] py-1.5 text-xs"
                aria-label="能力筛选"
              >
                <option value="all">全部能力</option>
                {filterOptions!.featureOptions!.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : null}

            <label className="relative ml-auto flex min-w-[120px] flex-1 items-center sm:max-w-[180px]">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--qr-text-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索"
                className="qr-input w-full py-1.5 pl-8 pr-8 text-xs"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 rounded p-0.5 hover:bg-white/10"
                  aria-label="清除搜索"
                >
                  <X className="h-3 w-3 text-[var(--qr-text-muted)]" />
                </button>
              ) : null}
            </label>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--qr-text-muted)]">
              没有匹配的模型
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((entry) => (
                <ModelRow
                  key={entry.modelKey}
                  entry={entry}
                  selected={selectedModelKey === entry.modelKey}
                  onSelect={() => pick(entry.modelKey)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </QrModal>
  );
}
