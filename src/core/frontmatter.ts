import matter from "gray-matter";
import type { Frontmatter } from "../types/article.ts";
import { KNOWN_FRONTMATTER_KEYS } from "../types/article.ts";
import { KamiError, EXIT_CODES } from "../types/result.ts";

/**
 * Use CORE_SCHEMA to prevent js-yaml from converting timestamp strings to Date objects.
 * CORE_SCHEMA handles bool, int, float, null, and arrays/objects correctly,
 * but treats timestamps as plain strings.
 */
const jsYaml = require("js-yaml");

const yamlEngine = {
  parse: (str: string) => jsYaml.load(str, { schema: jsYaml.CORE_SCHEMA }),
  stringify: (obj: object) =>
    jsYaml.dump(obj, { lineWidth: -1, schema: jsYaml.CORE_SCHEMA }),
};

/**
 * Loosely parse frontmatter without enforcing the kami schema.
 * Returns the raw key-value map (or empty object) plus the body.
 * Returns null if no frontmatter delimiter is present.
 */
export function looseParseFrontmatter(
  content: string,
): { frontmatter: Record<string, unknown>; body: string } | null {
  if (!content.startsWith("---")) return null;
  try {
    const { data, content: body } = matter(content, {
      engines: { yaml: yamlEngine },
    });
    return { frontmatter: data ?? {}, body: body.trim() };
  } catch {
    return null;
  }
}

/** Parse a Markdown string into frontmatter and body */
export function parseFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  try {
    const { data, content: body } = matter(content, {
      engines: { yaml: yamlEngine },
    });
    return {
      frontmatter: validateFrontmatter(data),
      body: body.trim(),
    };
  } catch (e) {
    throw new KamiError(
      `Failed to parse frontmatter: ${e instanceof Error ? e.message : String(e)}`,
      "INVALID_FRONTMATTER",
      EXIT_CODES.GENERAL_ERROR,
    );
  }
}

/** Serialize frontmatter and body back to a Markdown string */
export function serializeFrontmatter(
  frontmatter: Frontmatter,
  body: string,
): string {
  const fm: Record<string, unknown> = {
    title: frontmatter.title,
    tags: frontmatter.tags,
    created: frontmatter.created,
    updated: frontmatter.updated,
  };
  if (frontmatter.template) fm.template = frontmatter.template;
  if (frontmatter.aliases && frontmatter.aliases.length > 0)
    fm.aliases = frontmatter.aliases;
  if (frontmatter.draft) fm.draft = frontmatter.draft;

  // Custom (unknown) keys: alphabetical order for deterministic output
  const knownSet = new Set<string>(KNOWN_FRONTMATTER_KEYS);
  const customKeys = Object.keys(frontmatter)
    .filter((k) => !knownSet.has(k))
    .sort();
  for (const key of customKeys) {
    const value = frontmatter[key];
    if (value !== undefined) fm[key] = value;
  }

  return matter.stringify(body ? `\n${body}\n` : "\n", fm);
}

/** Validate and normalize frontmatter data */
export function validateFrontmatter(
  data: Record<string, unknown>,
): Frontmatter {
  if (!data.title || typeof data.title !== "string") {
    throw new KamiError(
      'Frontmatter must have a "title" field',
      "INVALID_FRONTMATTER",
      EXIT_CODES.GENERAL_ERROR,
    );
  }

  const tags = Array.isArray(data.tags)
    ? data.tags.map(String)
    : typeof data.tags === "string"
      ? [data.tags]
      : [];

  const now = new Date().toISOString();

  const toISOString = (val: unknown): string => {
    if (typeof val === "string") return val;
    if (val instanceof Date) return val.toISOString();
    return now;
  };

  const result: Frontmatter = {
    title: data.title,
    tags,
    created: toISOString(data.created),
    updated: toISOString(data.updated),
    template: typeof data.template === "string" ? data.template : undefined,
    aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : undefined,
    draft: typeof data.draft === "boolean" ? data.draft : undefined,
  };

  // Preserve unknown (custom) keys verbatim
  const knownSet = new Set<string>(KNOWN_FRONTMATTER_KEYS);
  for (const [key, value] of Object.entries(data)) {
    if (!knownSet.has(key)) result[key] = value;
  }

  return result;
}

/**
 * Extract custom (non-known) keys from a frontmatter object.
 * Returns undefined if there are none, so callers can omit the field.
 */
export function extractCustomFrontmatter(
  frontmatter: Frontmatter,
): Record<string, unknown> | undefined {
  const knownSet = new Set<string>(KNOWN_FRONTMATTER_KEYS);
  const custom: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!knownSet.has(key) && value !== undefined) {
      custom[key] = value;
      count++;
    }
  }
  return count > 0 ? custom : undefined;
}

/** Generate frontmatter for a new article */
export function generateFrontmatter(
  title: string,
  options?: {
    tags?: string[];
    template?: string;
    draft?: boolean;
  },
): Frontmatter {
  const now = new Date().toISOString();
  return {
    title,
    tags: options?.tags ?? [],
    created: now,
    updated: now,
    template: options?.template,
    draft: options?.draft || undefined,
  };
}
