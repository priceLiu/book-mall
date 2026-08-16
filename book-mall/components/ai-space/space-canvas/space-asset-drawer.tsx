"use client";

/**
 * 素材抽屉：两种取材方式。
 *
 * - **已收进**：`AiSpacePin`，即在子应用点过「展示到 AI 空间」的素材
 * - **全部资产**：全局资产库聚合视图，直接扫各应用源表，**无需先收藏** 就能放上画布
 *
 * 两者放上画布走的是同一条 `AiSpaceBlockRef`，Pin 只是快捷入口而非前置条件。
 */

import { useMemo, useState } from "react";

import type { AiSpaceLibraryAsset } from "@/lib/ai-space/ai-space-asset-library";
import type {
  AiSpacePinEntry,
  AiSpacePinMediaKind,
} from "@/lib/ai-space/ai-space-pin-types";
import { AI_SPACE_PIN_SOURCE_LABEL } from "@/lib/ai-space/ai-space-pin-types";
import { SPACE_BLOCK_LIST } from "@/lib/ai-space/space-blocks/types";
import { cn } from "@/lib/utils";

import {
  AssetLibraryFilters,
  AssetLibraryGrid,
  useAssetLibrary,
} from "../asset-library/asset-library-browser";

const KIND_LABEL: Record<AiSpacePinMediaKind, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
};

const KIND_FILTERS: { value: AiSpacePinMediaKind | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
];

/** 抽屉内的两种取材来源 */
type DrawerSource = "pinned" | "library";

export function SpaceAssetDrawer({
  pins,
  /** 当前选中块可接受的媒体形态；无选中块时为 null */
  acceptKinds,
  selectedBlockLabel,
  busy,
  onUseAsset,
  onUseLibraryAsset,
  onRemovePin,
}: {
  pins: AiSpacePinEntry[];
  acceptKinds: AiSpacePinMediaKind[] | null;
  selectedBlockLabel: string | null;
  busy: boolean;
  onUseAsset: (pin: AiSpacePinEntry) => void;
  onUseLibraryAsset: (asset: AiSpaceLibraryAsset) => void;
  onRemovePin: (pin: AiSpacePinEntry) => void;
}) {
  const [source, setSource] = useState<DrawerSource>("pinned");
  const [filter, setFilter] = useState<AiSpacePinMediaKind | "all">("all");
  const library = useAssetLibrary();

  const visible = useMemo(
    () => (filter === "all" ? pins : pins.filter((p) => p.resolved.kind === filter)),
    [pins, filter],
  );

  const hint = selectedBlockLabel
    ? `点素材放进选中的「${selectedBlockLabel}」；未选中块时会自动新建对应挂件。`
    : "点素材会自动新建对应挂件；先选中一个块可以放进该块。";

  const disabledKinds = useMemo(() => {
    if (!acceptKinds) return null;
    return (["image", "video", "audio"] as AiSpacePinMediaKind[]).filter(
      (k) => !acceptKinds.includes(k),
    );
  }, [acceptKinds]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setSource("pinned")}
          className={cn(
            "flex-1 rounded px-2 py-1 text-xs",
            source === "pinned"
              ? "bg-[#eaeef2] text-[#1f2328]"
              : "border border-[#d0d7de] text-[#656d76]",
          )}
        >
          已收进 {pins.length > 0 ? pins.length : ""}
        </button>
        <button
          type="button"
          onClick={() => setSource("library")}
          className={cn(
            "flex-1 rounded px-2 py-1 text-xs",
            source === "library"
              ? "bg-[#eaeef2] text-[#1f2328]"
              : "border border-[#d0d7de] text-[#656d76]",
          )}
        >
          全部资产
        </button>
      </div>

      <p className="text-xs leading-relaxed text-[#656d76]">{hint}</p>

      {source === "library" ? (
        <>
          <AssetLibraryFilters state={library} compact />
          <AssetLibraryGrid
            state={library}
            columnsClassName="grid-cols-2"
            disabledKinds={disabledKinds}
            busy={busy}
            primaryLabel="放到画布"
            onPrimary={onUseLibraryAsset}
          />
        </>
      ) : (
        <PinnedList
          visible={visible}
          filter={filter}
          setFilter={setFilter}
          acceptKinds={acceptKinds}
          busy={busy}
          onUseAsset={onUseAsset}
          onRemovePin={onRemovePin}
        />
      )}
    </div>
  );
}

function PinnedList({
  visible,
  filter,
  setFilter,
  acceptKinds,
  busy,
  onUseAsset,
  onRemovePin,
}: {
  visible: AiSpacePinEntry[];
  filter: AiSpacePinMediaKind | "all";
  setFilter: (v: AiSpacePinMediaKind | "all") => void;
  acceptKinds: AiSpacePinMediaKind[] | null;
  busy: boolean;
  onUseAsset: (pin: AiSpacePinEntry) => void;
  onRemovePin: (pin: AiSpacePinEntry) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded px-2 py-0.5 text-xs",
              filter === f.value
                ? "bg-[#1f2328] text-white"
                : "border border-[#d0d7de] text-[#656d76]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#d0d7de] p-4 text-center text-xs leading-relaxed text-[#656d76]">
          还没有收进空间的素材。在子应用点「展示到 AI 空间」可以收进来，
          也可以直接切到「全部资产」从各应用取材。
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {visible.map((pin) => {
            const usable = !acceptKinds || acceptKinds.includes(pin.resolved.kind);
            return (
              <li
                key={pin.pinId}
                className={cn(
                  "overflow-hidden rounded-md border",
                  usable ? "border-[#d0d7de]" : "border-[#eaeef2] opacity-45",
                )}
              >
                <button
                  type="button"
                  disabled={busy || !usable}
                  onClick={() => onUseAsset(pin)}
                  title={
                    usable
                      ? "放到画布"
                      : `选中的块不接受${KIND_LABEL[pin.resolved.kind]}素材`
                  }
                  className="block w-full text-left"
                >
                  <div className="aspect-square bg-[#f6f8fa]">
                    {pin.resolved.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pin.resolved.thumbnailUrl}
                        alt={pin.resolved.title ?? "素材"}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[11px] text-[#8c959f]">
                        {KIND_LABEL[pin.resolved.kind]}
                      </div>
                    )}
                  </div>
                  <div className="px-1.5 py-1">
                    <p className="truncate text-[11px] text-[#1f2328]">
                      {pin.caption ?? pin.resolved.title ?? "未命名"}
                    </p>
                    <p className="truncate text-[10px] text-[#8c959f]">
                      {AI_SPACE_PIN_SOURCE_LABEL[pin.sourceType]}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemovePin(pin)}
                  className="w-full border-t border-[#eaeef2] py-1 text-[10px] text-[#656d76] hover:text-destructive"
                >
                  移出空间
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 挂件面板：新建空块 */
export function SpaceWidgetPalette({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (blockType: string) => void;
}) {
  const assets = SPACE_BLOCK_LIST.filter((d) => d.group === "asset");
  const widgets = SPACE_BLOCK_LIST.filter((d) => d.group === "widget");

  const Group = ({
    title,
    items,
  }: {
    title: string;
    items: typeof SPACE_BLOCK_LIST;
  }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-[#1f2328]">{title}</p>
      <ul className="space-y-1">
        {items.map((def) => (
          <li key={def.type}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onCreate(def.type)}
              className="w-full rounded-md border border-[#d0d7de] px-2 py-1.5 text-left hover:border-[#8c959f] disabled:opacity-50"
            >
              <p className="text-xs font-medium text-[#1f2328]">{def.label}</p>
              <p className="text-[11px] text-[#656d76]">{def.description}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      <Group title="资产型" items={assets} />
      <Group title="装饰 / 功能" items={widgets} />
    </div>
  );
}
