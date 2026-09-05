import { describe, expect, it } from "vitest";

import { libtvAudioPatchFromTask } from "@/lib/canvas/libtv-audio-task-apply";
import type { CanvasTaskRecord } from "@/lib/canvas-api";

function task(
  patch: Partial<CanvasTaskRecord> &
    Pick<CanvasTaskRecord, "status" | "id">,
): CanvasTaskRecord {
  return {
    projectId: "p",
    nodeId: "n",
    kind: "IMAGE",
    model: "speech-2.6-hd",
    ossUrl: null,
    ephemeralUrl: null,
    textOutput: null,
    failCode: null,
    failMessage: null,
    submittedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  } as CanvasTaskRecord;
}

describe("libtvAudioPatchFromTask", () => {
  it("clears generating when TTS succeeds with a data preview", () => {
    const dataUrl = "data:audio/mpeg;base64,AAA";
    const patch = libtvAudioPatchFromTask(
      { runtime: { status: "running", taskId: "t1" } },
      task({
        id: "t1",
        status: "SUCCEEDED",
        ephemeralUrl: dataUrl,
        textOutput: "旁白",
      }),
    );
    expect(patch?.uploading).toBe(false);
    expect((patch?.runtime as { status?: string })?.status).toBe("done");
    expect(patch?.blobUrl).toBe(dataUrl);
  });

  it("uses https OSS as export url when backfill has landed", () => {
    const patch = libtvAudioPatchFromTask(
      { uploading: true, blobUrl: "data:audio/mpeg;base64,AAA" },
      task({
        id: "t1",
        status: "SUCCEEDED",
        ossUrl: "https://cdn.example/a.mp3",
        ephemeralUrl: "data:audio/mpeg;base64,AAA",
      }),
    );
    expect(patch?.uploading).toBe(false);
    expect(patch?.ossUrl).toBe("https://cdn.example/a.mp3");
  });
});
