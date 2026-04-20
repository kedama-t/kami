import { fromMarkdown } from "mdast-util-from-markdown";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Heading, Root, RootContent } from "mdast";
import { KamiError, EXIT_CODES } from "../types/result.ts";

export type SectionOp =
  | { kind: "replace"; content: string }
  | { kind: "append"; content: string }
  | { kind: "insertBefore"; content: string };

interface MatchedHeading {
  index: number;
  level: number;
  startLine: number; // 1-based, line containing the heading marker
  text: string;
}

function collectHeadings(tree: Root): MatchedHeading[] {
  const out: MatchedHeading[] = [];
  tree.children.forEach((node: RootContent, i) => {
    if (node.type !== "heading") return;
    const heading = node as Heading;
    if (!heading.position) return;
    out.push({
      index: i,
      level: heading.depth,
      startLine: heading.position.start.line,
      text: mdastToString(heading).trim(),
    });
  });
  return out;
}

function findSection(
  headings: MatchedHeading[],
  query: string,
): MatchedHeading {
  const trimmed = query.trim();
  const exact = headings.filter((h) => h.text === trimmed);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) {
    throw new KamiError(
      `Section '${trimmed}' is ambiguous (matches ${exact.length} headings)`,
      "AMBIGUOUS_SECTION",
      EXIT_CODES.AMBIGUOUS,
      exact.map((h) => h.text),
    );
  }
  const prefix = headings.filter((h) =>
    h.text.toLowerCase().startsWith(trimmed.toLowerCase()),
  );
  if (prefix.length === 1) return prefix[0]!;
  if (prefix.length > 1) {
    throw new KamiError(
      `Section '${trimmed}' is ambiguous (matches ${prefix.length} headings by prefix)`,
      "AMBIGUOUS_SECTION",
      EXIT_CODES.AMBIGUOUS,
      prefix.map((h) => h.text),
    );
  }
  throw new KamiError(
    `Section '${trimmed}' not found`,
    "SECTION_NOT_FOUND",
    EXIT_CODES.NOT_FOUND,
  );
}

/**
 * Edit a markdown body by scoping changes to a heading section.
 * The heading line itself is kept intact; only the body lines below it
 * (down to the next heading of the same or shallower depth) are touched.
 */
export function editSection(
  body: string,
  sectionQuery: string,
  op: SectionOp,
): string {
  const tree = fromMarkdown(body);
  const headings = collectHeadings(tree);
  const target = findSection(headings, sectionQuery);

  // Determine end of section: the line *before* the next heading whose
  // depth <= target.level (i.e. same or shallower). If none, EOF.
  const nextSibling = headings.find(
    (h) => h.startLine > target.startLine && h.level <= target.level,
  );

  const lines = body.split("\n");
  const headingLineIdx = target.startLine - 1; // to 0-based
  const sectionEndExclusive = nextSibling
    ? nextSibling.startLine - 1
    : lines.length;

  if (op.kind === "insertBefore") {
    const before = lines.slice(0, headingLineIdx);
    const after = lines.slice(headingLineIdx);
    const inserted = op.content.split("\n");
    // Insert with a blank separator line if the previous line isn't blank
    const needsBlank = before.length > 0 && before[before.length - 1] !== "";
    const block = needsBlank ? ["", ...inserted, ""] : [...inserted, ""];
    return [...before, ...block, ...after].join("\n");
  }

  // For replace/append, work on the body of the section (lines after heading)
  const bodyStart = headingLineIdx + 1;
  const sectionBody = lines.slice(bodyStart, sectionEndExclusive);

  let newSectionBody: string[];
  if (op.kind === "replace") {
    newSectionBody = op.content === "" ? [""] : op.content.split("\n");
  } else {
    // append: trim trailing blank lines from existing body, then add a blank + new content
    const trimmed = [...sectionBody];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1]!.trim() === "") {
      trimmed.pop();
    }
    const additions = op.content.split("\n");
    newSectionBody = trimmed.length === 0
      ? additions
      : [...trimmed, "", ...additions];
  }

  // Ensure exactly one trailing blank line before the next heading (if any)
  while (
    newSectionBody.length > 0 &&
    newSectionBody[newSectionBody.length - 1]!.trim() === ""
  ) {
    newSectionBody.pop();
  }
  if (nextSibling) newSectionBody.push("");

  return [
    ...lines.slice(0, bodyStart),
    ...newSectionBody,
    ...lines.slice(sectionEndExclusive),
  ].join("\n");
}
