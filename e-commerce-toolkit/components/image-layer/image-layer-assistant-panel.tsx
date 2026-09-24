"use client";

import { useMemo, useState } from "react";
import { Cpu, Layers } from "lucide-react";

import { ImageLayerAssistantFooter } from "@/components/image-layer/image-layer-assistant-footer";
import {
  ImageLayerEditPanel,
  type ImageLayerEditEntryView,
} from "@/components/image-layer/image-layer-edit-panel";
import { ImageLayerSelectionTools } from "@/components/image-layer/image-layer-selection-tools";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import type { ImageProcessingParamField } from "@/lib/ecom-image-processing-api";
import {
  isWan27RetouchModel,
  type ImageLayerCanvasToolMode,
  type ImageLayerSelectionSubTool,
} from "@/lib/image-layer-tool-mode";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

function ParamFields({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: ImageProcessingParamField[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="grid gap-2">
      {fields.map((f) => (
        <label key={f.name} className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-[#374151]">{f.label}</span>
          {f.type === "boolean" ? (
            <input
              type="checkbox"
              disabled={disabled}
              checked={Boolean(values[f.name] ?? f.defaultValue)}
              onChange={(e) => onChange(f.name, e.target.checked)}
              className="h-4 w-4 rounded border-[#d2d2d7]"
            />
          ) : f.type === "select" ? (
            <select
              disabled={disabled}
              value={String(values[f.name] ?? f.defaultValue ?? "")}
              onChange={(e) => onChange(f.name, e.target.value)}
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            >
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "integer" || f.type === "number" ? (
            <input
              type="number"
              disabled={disabled}
              step={f.type === "number" ? "0.1" : "1"}
              min={f.min}
              max={f.max}
              placeholder={f.hint ?? "随机"}
              value={
                values[f.name] === undefined || values[f.name] === ""
                  ? ""
                  : String(values[f.name])
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                onChange(f.name, v === "" ? undefined : Number(v));
              }}
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="text"
              disabled={disabled}
              placeholder={f.hint ?? undefined}
              value={String(values[f.name] ?? f.defaultValue ?? "")}
              onChange={(e) => onChange(f.name, e.target.value)}
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
            />
          )}
        </label>
      ))}
    </div>
  );
}

function LocalEditModelButton({
  label,
  modelKey,
  displayName,
  busy,
  onClick,
}: {
  label: string;
  modelKey: string;
  displayName?: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-left",
        "transition hover:border-[#2563eb]/40 hover:bg-[#f0f6ff]/50",
        busy && "opacity-60",
      )}
    >
      <Cpu className="h-4 w-4 shrink-0 text-[#2563eb]" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-[#6b7280]">{label}</p>
        <p className="truncate text-sm font-medium text-[#111827]">
          {displayName ?? modelKey}
        </p>
      </div>
    </button>
  );
}

type Props = {
  toolMode: ImageLayerCanvasToolMode;
  hasStack: boolean;
  busy: boolean;
  busyTitle?: string;
  busyDetail?: string;
  selectionSubTool: ImageLayerSelectionSubTool;
  brushSize: number;
  showTransparentMask: boolean;
  pendingBboxCount: number;
  retouchModel: string;
  retouchModels: StoryboardGatewayModel[];
  retouchModelsLoading: boolean;
  retouchModelsError?: string | null;
  retouchParams: Record<string, unknown>;
  retouchParamFields: ImageProcessingParamField[];
  retouchPrompt: string;
  retouchBusy: boolean;
  eraseBusy: boolean;
  editEntries: ImageLayerEditEntryView[];
  selectedLayerId?: string | null;
  editingLayerId?: string | null;
  editSubmitCount: number;
  onSelectionSubToolChange: (tool: ImageLayerSelectionSubTool) => void;
  onBrushSizeChange: (size: number) => void;
  onToggleTransparentMask: () => void;
  onClearSelection: () => void;
  onUndoBbox: () => void;
  onRetouchModelChange: (modelKey: string) => void;
  onRetouchParamsChange: (name: string, value: unknown) => void;
  onRetouchPromptChange: (value: string) => void;
  onRetouchSubmit: () => void;
  onEraseSubmit: () => void;
  onReloadRetouchModels: () => void;
  onSelectLayer?: (layerId: string) => void;
  onPromptChange: (layerId: string, value: string) => void;
  onSubmitAllEdits: () => void;
  onRemoveEditEntry: (layerId: string) => void;
};

export function ImageLayerAssistantPanel({
  toolMode,
  hasStack,
  busy,
  busyTitle,
  busyDetail,
  selectionSubTool,
  brushSize,
  showTransparentMask,
  pendingBboxCount,
  retouchModel,
  retouchModels,
  retouchModelsLoading,
  retouchModelsError,
  retouchParams,
  retouchParamFields,
  retouchPrompt,
  retouchBusy,
  eraseBusy,
  editEntries,
  selectedLayerId,
  editingLayerId,
  editSubmitCount,
  onSelectionSubToolChange,
  onBrushSizeChange,
  onToggleTransparentMask,
  onClearSelection,
  onUndoBbox,
  onRetouchModelChange,
  onRetouchParamsChange,
  onRetouchPromptChange,
  onRetouchSubmit,
  onEraseSubmit,
  onReloadRetouchModels,
  onSelectLayer,
  onPromptChange,
  onSubmitAllEdits,
  onRemoveEditEntry,
}: Props) {
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const currentRetouchModel = useMemo(
    () => retouchModels.find((m) => m.modelKey === retouchModel),
    [retouchModel, retouchModels],
  );

  const showSelectionTools =
    toolMode === "retouch" || toolMode === "erase" || toolMode === "decompose-bbox";

  const retouchUsesBbox =
    toolMode === "retouch" && isWan27RetouchModel(retouchModel);
  const effectiveSelectionSubTool = retouchUsesBbox ? "bbox" : selectionSubTool;

  if (toolMode === "layer-view" && hasStack) {
    return (
      <ImageLayerEditPanel
        entries={editEntries}
        selectedLayerId={selectedLayerId}
        busy={busy}
        editingLayerId={editingLayerId}
        busyTitle={busyTitle}
        busyDetail={busyDetail}
        onSelectLayer={onSelectLayer}
        onPromptChange={onPromptChange}
        onSubmitAll={onSubmitAllEdits}
        submitCount={editSubmitCount}
        onRemove={onRemoveEditEntry}
        hideHeader
      />
    );
  }

  const isLocalEdit = toolMode === "retouch" || toolMode === "erase";

  const localEditSubmitBar = isLocalEdit ? (
    <div
      className="sticky bottom-0 z-10 -mx-3 mt-2 border-t border-[#e5e7eb] bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
      data-ecom-assistant-bottom-dock
    >
      <ImageLayerAssistantFooter
        toolMode={toolMode}
        busy={busy}
        retouchBusy={retouchBusy}
        eraseBusy={eraseBusy}
        retouchPrompt={retouchPrompt}
        onRetouchSubmit={onRetouchSubmit}
        onEraseSubmit={onEraseSubmit}
      />
    </div>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--ecom-assistant-bg)]">
      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
        <div className="space-y-2">
          {busy ? (
            <StoryboardTaskStatus
              active
              surface="content"
              sweep
              title={busyTitle ?? "生成中…"}
              detail={busyDetail}
              className="mx-0"
            />
          ) : null}

          {showSelectionTools ? (
            <ImageLayerSelectionTools
              toolMode={toolMode}
              selectionSubTool={effectiveSelectionSubTool}
              brushSize={brushSize}
              showTransparentMask={showTransparentMask}
              pendingBboxCount={pendingBboxCount}
              busy={busy}
              compact={isLocalEdit}
              hideBrushToggle={retouchUsesBbox}
              onSelectionSubToolChange={onSelectionSubToolChange}
              onBrushSizeChange={onBrushSizeChange}
              onToggleTransparentMask={onToggleTransparentMask}
              onClearSelection={onClearSelection}
              onUndoBbox={onUndoBbox}
            />
          ) : null}

          {toolMode === "retouch" ? (
            <>
              <LocalEditModelButton
                label="重绘模型"
                modelKey={retouchModel}
                displayName={currentRetouchModel?.displayName}
                busy={busy}
                onClick={() => setModelPickerOpen(true)}
              />
              {retouchParamFields.length > 0 ? (
                <ParamFields
                  fields={retouchParamFields}
                  values={retouchParams}
                  onChange={onRetouchParamsChange}
                  disabled={busy}
                />
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#374151]">
                  替换描述
                </span>
                <textarea
                  value={retouchPrompt}
                  onChange={(e) => onRetouchPromptChange(e.target.value)}
                  rows={2}
                  disabled={busy}
                  placeholder="说明选区应替换成什么"
                  className="w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                />
              </label>
            </>
          ) : null}

          {toolMode === "erase" ? (
            <p className="text-xs leading-5 text-[#6b7280]">
              涂抹或框选要去掉的区域。将调用百炼「图像擦除补全」，自动填补背景；无需选择模型。
            </p>
          ) : null}

          {toolMode === "decompose-bbox" ? (
            <p className="flex items-center gap-1.5 text-xs text-[#6b7280]">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              框选完成后，点击顶栏拆层按钮
            </p>
          ) : null}

          {toolMode === "layer-view" && !hasStack ? (
            <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fafafa] p-3 text-sm text-[#9ca3af]">
              使用顶栏选择重绘、擦除或框选拆分工具。
            </div>
          ) : null}

          {localEditSubmitBar}
        </div>
      </div>

      <StoryboardModelPickerDialog
        open={modelPickerOpen}
        onOpenChange={setModelPickerOpen}
        mode="image"
        selectionOnly
        dialogTitle="选择重绘模型"
        models={retouchModels}
        modelsLoading={retouchModelsLoading}
        modelsEmptyHint={retouchModelsError ?? undefined}
        onRetryLoadModels={onReloadRetouchModels}
        value={retouchModel}
        onChange={onRetouchModelChange}
        hideTypeFilter
        onConfirm={(modelKey) => {
          onRetouchModelChange(modelKey);
          setModelPickerOpen(false);
        }}
      />
    </div>
  );
}
