import { describe, test, expect } from "bun:test";
import {
  parseFrontmatter,
  serializeFrontmatter,
  looseParseFrontmatter,
} from "../../src/core/frontmatter.ts";

describe("frontmatter passthrough", () => {
  test("parseFrontmatter preserves unknown keys", () => {
    const md = `---
title: Test
tags: [foo]
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-02T00:00:00.000Z
status: in-progress
priority: high
---

body here
`;
    const { frontmatter, body } = parseFrontmatter(md);
    expect(frontmatter.title).toBe("Test");
    expect(frontmatter.status).toBe("in-progress");
    expect(frontmatter.priority).toBe("high");
    expect(body).toBe("body here");
  });

  test("serializeFrontmatter writes custom keys alphabetically after known", () => {
    const fm = {
      title: "Test",
      tags: ["x"],
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-02T00:00:00.000Z",
      zebra: "last",
      alpha: "first",
      middle: "mid",
    };
    const serialized = serializeFrontmatter(fm, "body");
    const alphaIdx = serialized.indexOf("alpha:");
    const middleIdx = serialized.indexOf("middle:");
    const zebraIdx = serialized.indexOf("zebra:");
    const titleIdx = serialized.indexOf("title:");
    expect(titleIdx).toBeLessThan(alphaIdx);
    expect(alphaIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(zebraIdx);
  });

  test("round-trip preserves unknown keys intact", () => {
    const md = `---
title: Round
tags: []
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-02T00:00:00.000Z
status: in-progress
extra:
  nested: value
---

body
`;
    const { frontmatter, body } = parseFrontmatter(md);
    const rewritten = serializeFrontmatter(frontmatter, body);
    const reparsed = parseFrontmatter(rewritten);
    expect(reparsed.frontmatter.status).toBe("in-progress");
    expect(reparsed.frontmatter.extra).toEqual({ nested: "value" });
  });

  test("looseParseFrontmatter returns null when no delimiter", () => {
    expect(looseParseFrontmatter("just a body")).toBeNull();
  });

  test("looseParseFrontmatter accepts missing title", () => {
    const parsed = looseParseFrontmatter(`---
status: draft
priority: low
---
body
`);
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.status).toBe("draft");
    expect(parsed!.frontmatter.priority).toBe("low");
    expect(parsed!.body).toBe("body");
  });
});
