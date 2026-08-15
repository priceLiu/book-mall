"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

import { useEcomTemplateImport } from "@/components/template-gallery/ecom-template-import-provider";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EcomMediaLibraryTile,
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  DEFAULT_CUSTOM_PARSE_CONFIG,
  inferTemplateCategoryFromFilename,
  parseTemplateGalleryHtml,
  templateCategoryLabel,
  YIBIAIGC_DEMO_CARD_CONFIG,
  type HtmlParseConfig,
  type ParsedImportRow,
} from "@/lib/ecom-template-gallery/html-parse";
import {
  ECOM_TEMPLATE_CATEGORY_META,
  type EcomTemplateCategory,
  type EcomTemplateGalleryEntry,
  type EcomTemplateMediaKind,
} from "@/lib/ecom-template-gallery/types";
import { cn } from "@/lib/utils";

type MediaFilter = "all" | EcomTemplateMediaKind;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTemplates: EcomTemplateGalleryEntry[];
};

export function EcomTemplateGalleryImportDialog({
  open,
  onOpenChange,
  existingTemplates,
}: Props) {
  const { enqueueUpload } = useEcomTemplateImport();
  const [html, setHtml] = useState("");
  const [category, setCategory] = useState<EcomTemplateCategory>("accessories");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [preset, setPreset] = useState<"yibaiaigc-demo-card" | "custom">(
    "yibaiaigc-demo-card",
  );
  const [customConfig, setCustomConfig] = useState<HtmlParseConfig>(
    DEFAULT_CUSTOM_PARSE_CONFIG,
  );
  const [parsed, setParsed] = useState<ParsedImportRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileCategoryHint, setFileCategoryHint] =
    useState<EcomTemplateCategory | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setHtml("");
      setParsed([]);
      setSelected(new Set());
      setFileName(null);
      setFileCategoryHint(null);
      setFileError(null);
      setFileLoading(false);
      setDragOver(false);
    }
  }, [open]);

  const parseConfig =
    preset === "yibaiaigc-demo-card"
      ? YIBIAIGC_DEMO_CARD_CONFIG
      : customConfig;

  const categoryMismatch =
    fileCategoryHint != null && fileCategoryHint !== category;

  async function loadHtmlFile(file: File) {
    const name = file.name.toLowerCase();
    const isHtml =
      name.endsWith(".html") ||
      name.endsWith(".htm") ||
      file.type === "text/html" ||
      !file.type;
    if (!isHtml) {
      setFileError("请选择 .html / .htm 文件");
      return;
    }

    setFileError(null);
    setFileName(file.name);
    const inferred = inferTemplateCategoryFromFilename(file.name);
    setFileCategoryHint(inferred);
    if (inferred) setCategory(inferred);
    setFileLoading(true);
    try {
      const text = await file.text();
      setHtml(text);
      setParsed([]);
      setSelected(new Set());
    } catch {
      setFileError("读取文件失败，请重试");
    } finally {
      setFileLoading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void loadHtmlFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadHtmlFile(file);
  }

  function handleParse() {
    if (!html.trim()) return;
    setParsing(true);
    try {
      const rows = parseTemplateGalleryHtml(
        html,
        parseConfig,
        category,
        existingTemplates,
        mediaFilter,
      );
      setParsed(rows);
      setSelected(
        new Set(rows.filter((r) => !r.alreadyImported).map((r) => r.tempKey)),
      );
    } finally {
      setParsing(false);
    }
  }

  function toggleKey(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(parsed.map((r) => r.tempKey)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function handleUpload() {
    const picked = parsed.filter(
      (r) => selected.has(r.tempKey) && !r.alreadyImported,
    );
    if (picked.length === 0) return;
    enqueueUpload(
      picked.map((row) => ({
        id: row.suggestedId,
        title: row.title,
        thumbPreview: row.thumbSourceUrl ?? row.sourceUrl,
        category,
        mediaKind: row.mediaKind,
        sourceUrl: row.sourceUrl,
        ext: row.ext,
        hot: row.hot,
        posterUrl: row.posterUrl,
        thumbSourceUrl: row.thumbSourceUrl,
      })),
    );
    onOpenChange(false);
  }

  const htmlReady = html.trim().length > 0;
  const importedCount = parsed.filter((r) => r.alreadyImported).length;
  const newCount = parsed.length - importedCount;
  const uploadableSelected = parsed.filter(
    (r) => selected.has(r.tempKey) && !r.alreadyImported,
  ).length;
  const videoCount = parsed.filter((r) => r.mediaKind === "video").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>从 HTML 导入模板</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-[#1d1d1f]">HTML 来源</label>
              {fileName ? (
                <span className="truncate text-[10px] text-[#6e6e73]">{fileName}</span>
              ) : null}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "rounded-lg border border-dashed px-4 py-5 text-center transition",
                dragOver
                  ? "border-[#0071e3] bg-[#f0f6ff]"
                  : "border-[#e8e8ed] bg-[#fafafa]",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,text/html"
                className="hidden"
                onChange={handleFileInputChange}
              />
              {fileLoading ? (
                <p className="flex items-center justify-center gap-2 text-xs text-[#6e6e73]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在读取文件…
                </p>
              ) : (
                <>
                  <FileUp className="mx-auto h-6 w-6 text-[#86868b]" />
                  <p className="mt-2 text-xs text-[#1d1d1f]">
                    拖拽 HTML 文件到此处，或
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-[#0071e3] hover:underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    选择本地文件
                  </button>
                  <p className="mt-1 text-[10px] text-[#86868b]">
                    支持 .html / .htm（如 女装 图片.html）
                  </p>
                </>
              )}
              {fileError ? (
                <p className="mt-2 text-xs text-[#ff3b30]">{fileError}</p>
              ) : null}
            </div>

            <p className="text-[10px] text-[#86868b]">或直接粘贴 HTML 源码</p>
            <textarea
              value={html}
              onChange={(e) => {
                setHtml(e.target.value);
                if (e.target.value.trim()) setFileName(null);
              }}
              placeholder="粘贴页面 HTML…"
              className="h-32 w-full resize-y rounded-lg border border-[#e8e8ed] p-2 font-mono text-xs"
            />
            {htmlReady ? (
              <p className="text-[10px] text-[#6e6e73]">
                已载入约 {(html.length / 1024).toFixed(0)} KB 文本
                {fileCategoryHint ? (
                  <>
                    {" "}
                    · 文件名识别为「{templateCategoryLabel(fileCategoryHint)}」
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          {categoryMismatch ? (
            <p className="rounded-lg border border-[#ff9500] bg-[#fff8eb] px-3 py-2 text-xs text-[#1d1d1f]">
              文件名对应「{templateCategoryLabel(fileCategoryHint!)}」，当前选中「
              {templateCategoryLabel(category)}」。请切换到正确分类后再解析，否则 ID
              与页面品类会不一致。
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#1d1d1f]">分类</p>
            <div className="flex flex-wrap gap-2">
              {ECOM_TEMPLATE_CATEGORY_META.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    category === cat.id
                      ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                      : "border-[#e8e8ed] bg-white text-[#1d1d1f]",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#6e6e73]">解析媒体：</span>
            {(["all", "image", "video"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMediaFilter(m)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs",
                  mediaFilter === m
                    ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                    : "border-[#e8e8ed]",
                )}
              >
                {m === "all" ? "全部" : m === "image" ? "图片" : "视频"}
              </button>
            ))}
            {mediaFilter === "video" ? (
              <span className="text-[10px] text-[#6e6e73]">
                视频站 HTML 内 <code>&lt;video src&gt;</code> 为空，按封面同名推导 .mp4
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#6e6e73]">预设：</span>
            <button
              type="button"
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs",
                preset === "yibaiaigc-demo-card" && "border-[#0071e3] bg-[#f0f6ff]",
              )}
              onClick={() => setPreset("yibaiaigc-demo-card")}
            >
              DemoCard（yibaiaigc）
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs",
                preset === "custom" && "border-[#0071e3] bg-[#f0f6ff]",
              )}
              onClick={() => setPreset("custom")}
            >
              自定义规则
            </button>
            <button
              type="button"
              className="text-xs text-[#0071e3]"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "收起高级" : "高级规则"}
            </button>
          </div>

          {showAdvanced && preset === "custom" ? (
            <div className="space-y-2 rounded-lg border border-[#e8e8ed] p-3">
              {(
                [
                  ["blockMarker", "块分割标记"],
                  ["imageSrcPattern", "图片 src 正则"],
                  ["videoSrcPattern", "视频 src 正则"],
                  ["titlePattern", "标题正则"],
                  ["hotKeyword", "爆款关键词"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] text-[#6e6e73]">{label}</label>
                  <input
                    className="mt-0.5 w-full rounded border border-[#e8e8ed] px-2 py-1 font-mono text-xs"
                    value={customConfig[key]}
                    onChange={(e) =>
                      setCustomConfig((c) => ({ ...c, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex gap-2">
            <EcomButtonSecondary
              type="button"
              onClick={handleParse}
              disabled={parsing || fileLoading || !htmlReady}
            >
              {parsing ? (
                <>
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  解析中…
                </>
              ) : (
                "解析预览"
              )}
            </EcomButtonSecondary>
            {parsed.length > 0 ? (
              <>
                <button
                  type="button"
                  className="text-xs text-[#0071e3]"
                  onClick={selectAll}
                >
                  全选
                </button>
                <button
                  type="button"
                  className="text-xs text-[#6e6e73]"
                  onClick={selectNone}
                >
                  取消全选
                </button>
                <span className="text-xs text-[#6e6e73]">
                  已选 {selected.size} / {parsed.length} · 视频 {videoCount} ·
                  图片 {parsed.length - videoCount}
                  {importedCount > 0 ? (
                    <>
                      {" "}
                      · 已导入 {importedCount} · 待上传 {newCount}
                    </>
                  ) : null}
                </span>
              </>
            ) : null}
          </div>

          {parsed.length > 0 ? (
            <ul className={ECOM_LIBRARY_MEDIA_GRID_CLASS}>
              {parsed.map((row) => (
                <li key={row.tempKey} className="relative">
                  {row.alreadyImported ? (
                    <span className="absolute left-1 top-1 z-10 rounded bg-[#86868b] px-1 py-0.5 text-[9px] font-medium text-white">
                      已导入
                    </span>
                  ) : null}
                  {row.mediaKind === "video" ? (
                    <span className="absolute right-1 top-1 z-10 rounded bg-[#0071e3] px-1 py-0.5 text-[9px] font-medium text-white">
                      {row.videoUrlDerived ? "视频·推导" : "视频"}
                    </span>
                  ) : null}
                  <EcomMediaLibraryTile
                    kind={row.mediaKind}
                    src={row.sourceUrl}
                    thumbnailSrc={row.thumbSourceUrl ?? row.posterUrl ?? row.sourceUrl}
                    alt={row.title}
                    selected={selected.has(row.tempKey)}
                    onSelect={() => toggleKey(row.tempKey)}
                    aspectClass="aspect-[3/4]"
                    onPreview={() => {}}
                    disableLazy={false}
                  />
                  <p className="mt-1 truncate text-[10px] text-[#6e6e73]">
                    {row.title}
                  </p>
                  <ParsedRowUrl
                    label={row.mediaKind === "video" ? "视频" : "原图"}
                    url={row.sourceUrl}
                    accent={row.mediaKind === "video"}
                  />
                  {row.posterUrl ? (
                    <ParsedRowUrl label="封面" url={row.posterUrl} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          <EcomButtonSecondary type="button" onClick={() => onOpenChange(false)}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            type="button"
            disabled={uploadableSelected === 0}
            onClick={handleUpload}
          >
            上传 OSS（{uploadableSelected}）
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function urlFileName(url: string): string {
  const path = url.split("?")[0] ?? url;
  return path.split("/").pop() || url;
}

/** 解析预览行内的 URL：格子窄，只显示可区分的文件名，全文放 title，可点开核对 */
function ParsedRowUrl({
  label,
  url,
  accent,
}: {
  label: string;
  url: string;
  accent?: boolean;
}) {
  return (
    <p className="flex items-center gap-1 text-[10px] leading-4">
      <span className="shrink-0 text-[#86868b]">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={url}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "truncate hover:underline",
          accent ? "text-[#0071e3]" : "text-[#6e6e73]",
        )}
      >
        {urlFileName(url)}
      </a>
    </p>
  );
}
