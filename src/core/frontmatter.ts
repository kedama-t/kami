import matter from "gray-matter";
import type { Frontmatter } from "../types/article.ts";
import { KamiError, EXIT_CODES } from "../types/result.ts";

/**
 * Use CORE_SCHEMA to prevent js-yaml from converting timestamp strings to Date objects.
 * CORE_SCHEMA handles bool, int, float, null, and arrays/objects correctly,
 * but treats timestamps as plain strings.
 */
const jsYaml = require("js-yaml");

const yamlEngine = {
  parse: (str: string) => jsYaml.load(str, { schema: jsYaml.CORE_SCHEMA }),
  stringify: (obj: Record<string, unknown>) =>
    jsYaml.dump(obj, { lineWidth: -1, schema: jsYaml.CORE_SCHEMA }),
};

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

  return {
    title: data.title,
    tags,
    created: toISOString(data.created),
    updated: toISOString(data.updated),
    template: typeof data.template === "string" ? data.template : undefined,
    aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : undefined,
    draft: typeof data.draft === "boolean" ? data.draft : undefined,
  };
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
