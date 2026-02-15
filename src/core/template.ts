import { join, basename } from "node:path";
import type { Scope } from "../types/scope.ts";
import type { ScopePaths } from "../types/scope.ts";
import { LocalStorage } from "../storage/local.ts";
import { getScopePaths } from "./scope.ts";

const storage = new LocalStorage();

/** Template info returned by listTemplates */
export interface TemplateInfo {
  name: string;
  scope: Scope;
  filePath: string;
}

/** List available templates across scopes (local overrides global) */
export async function listTemplates(
  scopeRoots: Array<{ scope: Scope; root: string }>,
): Promise<TemplateInfo[]> {
  const seen = new Set<string>();
  const templates: TemplateInfo[] = [];

  // Local first, then global — local overrides global for same name
  for (const { scope, root } of scopeRoots) {
    const paths = getScopePaths(root);
    const files = await storage.listFiles(paths.templates, "*.md");

    for (const filePath of files) {
      const name = basename(filePath, ".md");
      if (!seen.has(name)) {
        seen.add(name);
        templates.push({ name, scope, filePath });
      }
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/** Read a template by name (local-first resolution) */
export async function readTemplate(
  name: string,
  scopeRoots: Array<{ scope: Scope; root: string }>,
): Promise<{ content: string; scope: Scope; filePath: string } | null> {
  for (const { scope, root } of scopeRoots) {
    const paths = getScopePaths(root);
    const filePath = join(paths.templates, `${name}.md`);
    if (await storage.exists(filePath)) {
      const content = await storage.readFile(filePath);
      return { content, scope, filePath };
    }
  }
  return null;
}

/** Create a new template */
export async function createTemplate(
  name: string,
  content: string | undefined,
  scopeRoot: string,
): Promise<string> {
  const paths = getScopePaths(scopeRoot);
  await storage.mkdir(paths.templates);

  const filePath = join(paths.templates, `${name}.md`);

  const body =
    content ??
    `---
title: ""
tags: []
---
`;

  await storage.writeFile(filePath, body);
  return filePath;
}

/** Expand template variables */
export function expandTemplate(
  templateContent: string,
  variables: Record<string, string>,
): string {
  let result = templateContent;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/** Get the built-in templates directory (project root templates/) */
export function getBuiltinTemplatesDir(): string {
  return join(import.meta.dir, "..", "..", "templates");
}

/** Build standard template variables for article creation */
export function buildTemplateVariables(
  title: string,
  folder?: string,
): Record<string, string> {
  const now = new Date();
  return {
    title,
    date: now.toISOString().slice(0, 10),
    datetime: now.toISOString(),
    folder: folder ?? "",
  };
}
