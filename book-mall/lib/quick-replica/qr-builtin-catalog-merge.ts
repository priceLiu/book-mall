import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";

/** 管理后台覆盖内置模板时，保留 builtin 成片 / 槽位，避免右栏视频无法播放 */
export function mergeBuiltinWithOverride(
  builtin: QrTemplateJson,
  override: QrTemplateJson,
): QrTemplateJson {
  const overrideOutputUrl = override.output?.url?.trim() ?? "";
  const output =
    overrideOutputUrl.length > 0
      ? override.output
      : builtin.output ?? override.output;

  return {
    ...builtin,
    ...override,
    id: builtin.id,
    source: "builtin",
    visibility: "public",
    thumbnailUrl: override.thumbnailUrl?.trim() || builtin.thumbnailUrl,
    reference: {
      ...builtin.reference,
      ...override.reference,
      slots: {
        ...builtin.reference.slots,
        ...override.reference.slots,
      },
      prompt: override.reference?.prompt ?? builtin.reference.prompt,
      model: override.reference?.model ?? builtin.reference.model,
    },
    output,
  };
}
