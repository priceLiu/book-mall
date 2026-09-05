import { describe, expect, it } from "vitest";
import {
  dedupeParamsSchemaByKey,
  durationBoundsFromVideoSchema,
  filterDockVideoParamsSchema,
} from "@/lib/canvas/sbv1-video-dock-params-schema";

describe("sbv1-video-dock-params-schema", () => {
  it("dedupes schema items by key", () => {
    const schema = dedupeParamsSchemaByKey([
      {
        key: "duration",
        label: "时长(秒)",
        type: "number",
        min: 5,
        max: 10,
        step: 5,
      },
      {
        key: "duration",
        label: "duration (sec)",
        type: "number",
        min: 3,
        max: 15,
        step: 1,
      },
    ]);
    expect(schema).toHaveLength(1);
    expect(schema[0]?.label).toBe("时长(秒)");
  });

  it("filters dock-handled keys for DynamicParamForm", () => {
    const filtered = filterDockVideoParamsSchema([
      {
        key: "ratio",
        label: "画布比例",
        type: "select",
        options: [{ value: "16:9", label: "16:9" }],
      },
      {
        key: "duration",
        label: "时长(秒)",
        type: "number",
        min: 3,
        max: 15,
      },
      {
        key: "prompt_extend",
        label: "智能扩写",
        type: "boolean",
        defaultValue: true,
      },
    ]);
    expect(filtered.map((item) => item.key)).toEqual(["prompt_extend"]);
  });

  it("reads duration bounds from schema", () => {
    expect(
      durationBoundsFromVideoSchema([
        {
          key: "duration",
          label: "duration (sec)",
          type: "number",
          min: 3,
          max: 15,
          step: 1,
        },
      ]),
    ).toEqual({
      min: 3,
      max: 15,
      step: 1,
      label: "时长(秒)",
    });
  });
});
