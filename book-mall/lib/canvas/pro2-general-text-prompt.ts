/**
 * 2.0 文本节点 · general LLM user 消息。
 * 用户 Dock 指令必须在前；上游引用正文随后，避免 Gateway 只看到上一节点内容。
 */
export function composeStoryProGeneralTextUserPrompt(args: {
  themeInput: string;
  textInputs?: string[];
}): string {
  const instruction = args.themeInput.trim();
  const upstream = (args.textInputs ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (instruction && upstream.length > 0) {
    return [instruction, "---", "以下为引用的上游文本：", ...upstream].join(
      "\n\n",
    );
  }
  return instruction || upstream.join("\n\n");
}
