import type { StoryboardDeliverable } from "@/lib/ecom/ecom-storyboard-deliverable";
import {
  extractStoryboardDeliverable,
  schemeToSheet,
} from "@/lib/ecom/ecom-storyboard-deliverable";
import {
  fashionVersionToSheet,
  isFashionWorkflow,
  mergeFashionSheetWithExisting,
  readMetaFashionDeliverable,
  resolveFashionDeliverableForProject,
} from "@/lib/ecom/ecom-fashion-deliverable";
import { parseStoryboardSchemesFromMarkdown } from "@/lib/ecom/ecom-storyboard-markdown-parse";
import {
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";
import type { StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";

export async function syncEcomStoryboardSheetFromMeta(
  userId: string,
  projectId: string,
  opts?: { schemeIndex?: number },
): Promise<{
  sheet: StoryboardSheet | null;
  deliverable: StoryboardDeliverable | null;
  selectedSchemeIndex: number;
}> {
  const project = await getEcomStoryboardProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const metaRecord = (project.meta as Record<string, unknown> | null) ?? {};
  if (isFashionWorkflow(metaRecord)) {
    const existingDeliverable = readMetaFashionDeliverable(metaRecord.deliverable);
    const deliverable = resolveFashionDeliverableForProject({
      meta: metaRecord,
      chatHistory: project.chatHistory,
    });
    if (deliverable?.selectedVersion) {
      const sheet = fashionVersionToSheet(deliverable);
      if (sheet) {
        const mergedSheet = mergeFashionSheetWithExisting(sheet, project.sheet);
        const deliverableToSave = {
          ...deliverable,
          outputMode: existingDeliverable?.outputMode ?? deliverable.outputMode,
          opsPack: existingDeliverable?.opsPack ?? deliverable.opsPack,
          storyboardLocked: true,
        };
        const existingWf =
          (project.meta?.workflow as Record<string, unknown> | undefined) ?? {};
        await updateEcomStoryboardProject(userId, projectId, {
          sheet: mergedSheet,
          status: "sheet_ready",
          meta: {
            ...project.meta,
            deliverable: deliverableToSave,
            workflow: {
              ...existingWf,
              vertical: "fashion_apparel",
              fashionPhase: deliverableToSave.outputMode ? "produce" : "output_mode",
              ...(deliverableToSave.outputMode === "direct_video"
                ? { fashionProduceSetupPending: true }
                : {}),
            },
          },
        });
        return {
          sheet: mergedSheet,
          deliverable: null,
          selectedSchemeIndex: 0,
        };
      }
      throw new Error(
        `定稿分镜 ${deliverable.selectedVersion} 版缺少分镜表数据，请在中栏 12.1 确认分镜表已保存后重试`,
      );
    }
    if (deliverable) {
      throw new Error(
        "未找到已定稿的分镜版本，请先在助手确认分镜并生成运营包后再选择成片方式",
      );
    }
    return { sheet: project.sheet, deliverable: null, selectedSchemeIndex: 0 };
  }

  if (project.sheet) {
    return {
      sheet: project.sheet,
      deliverable: project.meta?.deliverable ?? null,
      selectedSchemeIndex: project.meta?.selectedSchemeIndex ?? 0,
    };
  }

  const selectedIndex = opts?.schemeIndex ?? project.meta?.selectedSchemeIndex ?? 0;
  let deliverable = project.meta?.deliverable ?? null;
  let schemes = deliverable?.schemes ?? [];

  if (schemes.length === 0) {
    const markdown =
      project.meta?.deliverableMarkdown ??
      (project.chatHistory.length
        ? [...project.chatHistory].reverse().find((m) => m.role === "assistant")?.content
        : undefined);

    if (markdown) {
      deliverable = extractStoryboardDeliverable(markdown);
      schemes = deliverable?.schemes ?? [];

      if (schemes.length === 0) {
        schemes = parseStoryboardSchemesFromMarkdown(markdown);
        if (schemes.length > 0) {
          deliverable = { ...(deliverable ?? {}), schemes };
        }
      }
    }
  }

  const scheme = schemes[selectedIndex] ?? schemes[0];
  if (!scheme) {
    return { sheet: null, deliverable, selectedSchemeIndex: selectedIndex };
  }

  const wf = project.meta?.workflow as { schemePicked?: boolean } | undefined;
  if (schemes.length > 1 && !wf?.schemePicked) {
    return { sheet: null, deliverable, selectedSchemeIndex: selectedIndex };
  }

  const sheet = schemeToSheet(scheme, deliverable ?? undefined);
  const idx = schemes[selectedIndex] ? selectedIndex : 0;

  await updateEcomStoryboardProject(userId, projectId, {
    sheet,
    status: "sheet_ready",
    meta: {
      ...project.meta,
      deliverable: deliverable ?? project.meta?.deliverable,
      selectedSchemeIndex: idx,
    },
  });

  return { sheet, deliverable, selectedSchemeIndex: idx };
}
