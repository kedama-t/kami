import { describe, test, expect } from "bun:test";
import { editSection } from "../../src/core/section.ts";
import { KamiError } from "../../src/types/result.ts";

const SAMPLE = `# Title

intro text

## Tasks

- old1
- old2

## Notes

note body
`;

describe("editSection", () => {
  test("replace swaps section body, preserves heading and surroundings", () => {
    const result = editSection(SAMPLE, "Tasks", {
      kind: "replace",
      content: "- new",
    });
    expect(result).toContain("## Tasks");
    expect(result).toContain("- new");
    expect(result).not.toContain("- old1");
    expect(result).toContain("## Notes");
    expect(result).toContain("note body");
  });

  test("append adds content to end of section", () => {
    const result = editSection(SAMPLE, "Tasks", {
      kind: "append",
      content: "- new",
    });
    const tasksIdx = result.indexOf("## Tasks");
    const notesIdx = result.indexOf("## Notes");
    const slice = result.slice(tasksIdx, notesIdx);
    expect(slice).toContain("- old1");
    expect(slice).toContain("- old2");
    expect(slice).toContain("- new");
  });

  test("insertBefore puts content above the heading", () => {
    const result = editSection(SAMPLE, "Notes", {
      kind: "insertBefore",
      content: "## Inserted\n\nbefore notes",
    });
    const insertedIdx = result.indexOf("## Inserted");
    const notesIdx = result.indexOf("## Notes");
    expect(insertedIdx).toBeGreaterThan(0);
    expect(insertedIdx).toBeLessThan(notesIdx);
  });

  test("prefix match resolves uniquely", () => {
    const result = editSection(SAMPLE, "Tas", {
      kind: "replace",
      content: "x",
    });
    expect(result).toContain("## Tasks");
    expect(result).toContain("x");
  });

  test("missing section throws SECTION_NOT_FOUND", () => {
    expect(() =>
      editSection(SAMPLE, "Nonexistent", { kind: "replace", content: "" }),
    ).toThrow(KamiError);
  });

  test("ambiguous prefix throws AMBIGUOUS_SECTION", () => {
    const md = `## Project Alpha\n\na\n\n## Project Beta\n\nb\n`;
    expect(() =>
      editSection(md, "Project", { kind: "replace", content: "x" }),
    ).toThrow(/ambiguous/i);
  });

  test("section without next sibling reaches EOF", () => {
    const md = `## A\n\naaa\n\n## B\n\nbbb\n`;
    const result = editSection(md, "B", { kind: "replace", content: "BBB" });
    expect(result).toContain("## A");
    expect(result).toContain("aaa");
    expect(result).toContain("## B");
    expect(result).toContain("BBB");
    expect(result).not.toContain("bbb");
  });

  test("nested heading is bounded by same-or-shallower next heading", () => {
    const md = `# Top\n\n## Section\n\noriginal\n\n### Sub\n\nsub body\n\n## Other\n\nother\n`;
    // Replacing "Section" should include "### Sub" and its body, since ### is deeper
    const result = editSection(md, "Section", {
      kind: "replace",
      content: "REPLACED",
    });
    expect(result).toContain("## Section");
    expect(result).toContain("REPLACED");
    expect(result).not.toContain("### Sub");
    expect(result).not.toContain("sub body");
    expect(result).toContain("## Other");
    expect(result).toContain("other");
  });
});
