import { describe, expect, it } from "vitest";
import {
  applyMasterModelCommand,
  applyMasterModelEdit,
  createDefaultMasterModelForSnapshot,
} from "../src/memory";

describe("Memory public seam", () => {
  it("owns Master Model command APIs", () => {
    expect(applyMasterModelCommand).toBeTypeOf("function");
    expect(createDefaultMasterModelForSnapshot).toBeTypeOf("function");
  });

  it("keeps the legacy edit helper as an alias to the command seam", () => {
    expect(applyMasterModelEdit).toBe(applyMasterModelCommand);
  });
});
