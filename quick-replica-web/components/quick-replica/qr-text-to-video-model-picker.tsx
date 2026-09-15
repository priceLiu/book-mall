"use client";

import { useEffect, useMemo, useState } from "react";
import { QrModelPicker } from "@/components/quick-replica/qr-model-picker";
import {
  QR_T2V_CATEGORY_OPTIONS,
  QR_T2V_FEATURE_FILTER_OPTIONS,
  QR_T2V_MODEL_CATALOG,
  QR_T2V_PROVIDER_OPTIONS,
} from "@/lib/qr-text-to-video-model-catalog";
import { fetchQrModelTemplateCatalog, qrModelKeysForTemplate } from "@/lib/model-template-catalog";

type Props = {
  open: boolean;
  selectedModelKey: string;
  onSelect: (modelKey: string) => void;
  onClose: () => void;
};

export function QrTextToVideoModelPicker({ open, selectedModelKey, onSelect, onClose }: Props) {
  const [templateKeys, setTemplateKeys] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchQrModelTemplateCatalog().then((catalog) => {
      if (cancelled) return;
      const keys = [
        ...qrModelKeysForTemplate(catalog, "t2v"),
        ...qrModelKeysForTemplate(catalog, "i2v"),
      ];
      setTemplateKeys(keys.length > 0 ? keys : null);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const catalog = useMemo(() => {
    if (!templateKeys?.length) return QR_T2V_MODEL_CATALOG;
    const set = new Set(templateKeys.map((k) => k.toLowerCase()));
    const filtered = QR_T2V_MODEL_CATALOG.filter((m) => set.has(m.modelKey.toLowerCase()));
    return filtered.length > 0 ? filtered : QR_T2V_MODEL_CATALOG;
  }, [templateKeys]);

  return (
    <QrModelPicker
      open={open}
      title="模型"
      selectedModelKey={selectedModelKey}
      catalog={catalog}
      filterOptions={{
        providerOptions: QR_T2V_PROVIDER_OPTIONS,
        categoryOptions: QR_T2V_CATEGORY_OPTIONS,
        featureOptions: QR_T2V_FEATURE_FILTER_OPTIONS,
      }}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
