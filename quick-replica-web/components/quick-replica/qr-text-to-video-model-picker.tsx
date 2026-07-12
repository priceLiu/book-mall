"use client";

import { QrModelPicker } from "@/components/quick-replica/qr-model-picker";
import {
  QR_T2V_CATEGORY_OPTIONS,
  QR_T2V_FEATURE_FILTER_OPTIONS,
  QR_T2V_MODEL_CATALOG,
  QR_T2V_PROVIDER_OPTIONS,
} from "@/lib/qr-text-to-video-model-catalog";

type Props = {
  open: boolean;
  selectedModelKey: string;
  onSelect: (modelKey: string) => void;
  onClose: () => void;
};

export function QrTextToVideoModelPicker({ open, selectedModelKey, onSelect, onClose }: Props) {
  return (
    <QrModelPicker
      open={open}
      title="模型"
      selectedModelKey={selectedModelKey}
      catalog={QR_T2V_MODEL_CATALOG}
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
