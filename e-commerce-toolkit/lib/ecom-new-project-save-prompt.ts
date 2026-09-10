export type EcomSaveBeforeNewConfirm = (opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) => Promise<boolean>;

/**
 * 点击「新建项目」前询问是否保存；选「先保存」则 await save() 后再 onProceed。
 */
export async function runEcomNewProjectWithSavePrompt(args: {
  confirm: EcomSaveBeforeNewConfirm;
  hasWorkToSave: boolean;
  save: () => Promise<void>;
  onProceed: () => void | Promise<void>;
  message?: string;
}): Promise<void> {
  const { confirm, hasWorkToSave, save, onProceed, message } = args;
  if (hasWorkToSave) {
    const shouldSave = await confirm({
      title: "新建项目",
      message:
        message ??
        "当前项目有未保存的内容。是否先保存？选择「不保存，直接新建」将开启空白项目。",
      confirmLabel: "先保存",
      cancelLabel: "不保存，直接新建",
    });
    if (shouldSave) {
      try {
        await save();
      } catch {
        return;
      }
    }
  }
  await onProceed();
}
