"use client";

import { ProductDesignEditableField } from "@/components/product-design/product-design-editable-field";
import type { ProductDesignMainImage } from "@/lib/product-design-types";

const LAYER_ROWS: Array<{
  key: keyof ProductDesignMainImage["layers"];
  label: string;
  multiline?: boolean;
}> = [
  { key: "topHint", label: "顶部引导小字" },
  { key: "title", label: "核心主标题" },
  { key: "subtitle", label: "副标题" },
  { key: "bullets", label: "核心卖点", multiline: true },
  { key: "delivery", label: "交付 / 服务说明" },
  { key: "footer", label: "底部信任收口" },
];

type Props = {
  items: ProductDesignMainImage[];
  onSaveItem?: (
    index: number,
    updater: (prev: ProductDesignMainImage) => ProductDesignMainImage,
  ) => void | Promise<void>;
};

/** Step4 主图分层定稿文案（结论区，单元格可编辑） */
export function ProductDesignMainCopyPanel({ items, onSaveItem }: Props) {
  if (items.length === 0) return null;

  function saveLayer(
    item: ProductDesignMainImage,
    layerKey: keyof ProductDesignMainImage["layers"],
    text: string,
  ) {
    if (!onSaveItem) return;
    void onSaveItem(item.index, (prev) => {
      if (layerKey === "bullets") {
        return {
          ...prev,
          layers: {
            ...prev.layers,
            bullets: text
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        };
      }
      return {
        ...prev,
        layers: { ...prev.layers, [layerKey]: text },
      };
    });
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article
          key={item.index}
          className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-white"
        >
          <header className="border-b border-[#f0f0f2] bg-[#fafafa] px-4 py-2.5">
            <div className="flex items-start gap-2">
              <p className="shrink-0 text-sm font-semibold text-[#1d1d1f]">
                主图 {item.index}
              </p>
              {onSaveItem ? (
                <div className="min-w-0 flex-1">
                  <ProductDesignEditableField
                    label="用途"
                    value={item.purpose}
                    onSave={(v) =>
                      onSaveItem(item.index, (prev) => ({ ...prev, purpose: v }))
                    }
                  />
                </div>
              ) : item.purpose.trim() ? (
                <span className="text-sm font-normal text-[#6e6e73]">
                  · {item.purpose}
                </span>
              ) : null}
            </div>
          </header>
          <div className="divide-y divide-[#f0f0f2] px-4 py-1">
            {LAYER_ROWS.map((row) => {
              if (row.key === "bullets") {
                const bullets = item.layers.bullets.filter(Boolean);
                const value = bullets.join("\n");
                if (!onSaveItem && bullets.length === 0) return null;
                return (
                  <div key={row.key} className="py-2.5">
                    {onSaveItem ? (
                      <ProductDesignEditableField
                        label={row.label}
                        value={value}
                        multiline
                        rows={4}
                        onSave={(text) => saveLayer(item, "bullets", text)}
                      />
                    ) : (
                      <ul className="list-inside list-disc space-y-1 text-xs text-[#1d1d1f]">
                        {bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }
              const value =
                typeof item.layers[row.key] === "string"
                  ? (item.layers[row.key] as string)
                  : "";
              if (!onSaveItem && !value.trim()) return null;
              return (
                <div key={row.key} className="py-2.5">
                  {onSaveItem ? (
                    <ProductDesignEditableField
                      label={row.label}
                      value={value}
                      multiline={row.multiline}
                      rows={row.multiline ? 3 : 2}
                      onSave={(text) => saveLayer(item, row.key, text)}
                    />
                  ) : (
                    <div className="grid grid-cols-[7rem_1fr] gap-3 text-xs">
                      <span className="font-medium text-[#86868b]">{row.label}</span>
                      <span className="text-[#1d1d1f]">{value || "—"}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {onSaveItem ||
          item.emphasis.bold.length > 0 ||
          item.emphasis.color.length > 0 ? (
            <footer className="space-y-2 border-t border-[#f0f0f2] bg-[#fafafa] px-4 py-2.5">
              {onSaveItem ? (
                <>
                  <ProductDesignEditableField
                    label="加粗强调（顿号或换行分隔）"
                    value={item.emphasis.bold.join("、")}
                    multiline
                    rows={2}
                    onSave={(text) =>
                      onSaveItem(item.index, (prev) => ({
                        ...prev,
                        emphasis: {
                          ...prev.emphasis,
                          bold: text
                            .split(/[、,\n]/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                  <ProductDesignEditableField
                    label="彩色强调（顿号或换行分隔）"
                    value={item.emphasis.color.join("、")}
                    multiline
                    rows={2}
                    onSave={(text) =>
                      onSaveItem(item.index, (prev) => ({
                        ...prev,
                        emphasis: {
                          ...prev.emphasis,
                          color: text
                            .split(/[、,\n]/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                </>
              ) : (
                <>
                  {item.emphasis.bold.length > 0 ? (
                    <p className="text-[11px] text-[#6e6e73]">
                      <span className="font-medium text-[#1d1d1f]">加粗强调：</span>
                      {item.emphasis.bold.join("、")}
                    </p>
                  ) : null}
                  {item.emphasis.color.length > 0 ? (
                    <p className="text-[11px] text-[#6e6e73]">
                      <span className="font-medium text-[#1d1d1f]">彩色强调：</span>
                      {item.emphasis.color.join("、")}
                    </p>
                  ) : null}
                </>
              )}
            </footer>
          ) : null}
        </article>
      ))}
    </div>
  );
}
