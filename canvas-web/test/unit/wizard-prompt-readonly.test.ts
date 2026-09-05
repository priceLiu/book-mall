import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardPromptReadonly } from "@/components/canvas/mentions/wizard-prompt-readonly";

describe("WizardPromptReadonly", () => {
  it("renders green mention badge for @<wiz-*> token", () => {
    const html = renderToStaticMarkup(
      <WizardPromptReadonly
        value="特写 @<wiz-scene-s1> 中的 @<wiz-char-c1>"
        mentionables={[
          { id: "wiz-scene-s1", label: "场景 · 现代深夜办公室", kind: "scene" },
          { id: "wiz-char-c1", label: "角色 · 现代沈昭昭", kind: "character" },
        ]}
      />,
    );
    expect(html).toContain("text-emerald-300");
    expect(html).toContain("@场景 · 现代深夜办公室");
    expect(html).toContain("@角色 · 现代沈昭昭");
    expect(html).not.toContain("wiz-scene-s1");
  });

  it("supports bare @wiz-* tokens from Pass2 output", () => {
    const html = renderToStaticMarkup(
      <WizardPromptReadonly
        value="画面 @wiz-scene-s1 中心"
        mentionables={[
          { id: "wiz-scene-s1", label: "场景 · 办公室", kind: "scene" },
        ]}
      />,
    );
    expect(html).toContain("@场景 · 办公室");
  });
});
