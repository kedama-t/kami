import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  listTemplates,
  readTemplate,
  createTemplate,
  expandTemplate,
  buildTemplateVariables,
} from "../../src/core/template.ts";
import { initLocalScope, getScopePaths } from "../../src/core/scope.ts";
import { LocalStorage } from "../../src/storage/local.ts";

const storage = new LocalStorage();

describe("template", () => {
  let tmpDir: string;
  let localRoot: string;
  let globalRoot: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "kami-template-test-"));
    localRoot = await initLocalScope(tmpDir);

    // Create a fake global scope
    globalRoot = join(tmpDir, "global-kami");
    const globalPaths = getScopePaths(globalRoot);
    await storage.mkdir(globalPaths.vault);
    await storage.mkdir(globalPaths.templates);

    // Write some templates
    await storage.writeFile(
      join(globalPaths.templates, "note.md"),
      '---\ntitle: "{{title}}"\ntags: []\ncreated: {{datetime}}\nupdated: {{datetime}}\ntemplate: note\n---\n\n# {{title}}\n',
    );
    await storage.writeFile(
      join(globalPaths.templates, "daily.md"),
      '---\ntitle: "{{date}}"\ntags: [daily]\ncreated: {{datetime}}\nupdated: {{datetime}}\ntemplate: daily\n---\n\n# {{date}}\n\n## Log\n',
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("listTemplates", () => {
    test("lists templates from both scopes", async () => {
      const templates = await listTemplates([
        { scope: "local", root: localRoot },
        { scope: "global", root: globalRoot },
      ]);
      // Global has note.md and daily.md
      expect(templates.length).toBeGreaterThanOrEqual(2);
      expect(templates.some((t) => t.name === "note")).toBe(true);
      expect(templates.some((t) => t.name === "daily")).toBe(true);
    });

    test("local overrides global for same name", async () => {
      const localPaths = getScopePaths(localRoot);
      await storage.writeFile(
        join(localPaths.templates, "note.md"),
        "# Local note template\n",
      );

      const templates = await listTemplates([
        { scope: "local", root: localRoot },
        { scope: "global", root: globalRoot },
      ]);

      const noteTemplate = templates.find((t) => t.name === "note");
      expect(noteTemplate).toBeDefined();
      expect(noteTemplate!.scope).toBe("local");
    });

    test("returns empty for scope with no templates", async () => {
      const emptyRoot = join(tmpDir, "empty-kami");
      const emptyPaths = getScopePaths(emptyRoot);
      await storage.mkdir(emptyPaths.templates);

      const templates = await listTemplates([
        { scope: "local", root: emptyRoot },
      ]);
      expect(templates).toHaveLength(0);
    });
  });

  describe("readTemplate", () => {
    test("reads template by name (local-first)", async () => {
      const result = await readTemplate("note", [
        { scope: "local", root: localRoot },
        { scope: "global", root: globalRoot },
      ]);
      expect(result).not.toBeNull();
      expect(result!.scope).toBe("global");
      expect(result!.content).toContain("{{title}}");
    });

    test("local template overrides global", async () => {
      const localPaths = getScopePaths(localRoot);
      await storage.writeFile(
        join(localPaths.templates, "note.md"),
        "# Local override\n",
      );

      const result = await readTemplate("note", [
        { scope: "local", root: localRoot },
        { scope: "global", root: globalRoot },
      ]);
      expect(result!.scope).toBe("local");
      expect(result!.content).toContain("Local override");
    });

    test("returns null for non-existent template", async () => {
      const result = await readTemplate("nonexistent", [
        { scope: "local", root: localRoot },
        { scope: "global", root: globalRoot },
      ]);
      expect(result).toBeNull();
    });
  });

  describe("createTemplate", () => {
    test("creates template with default content", async () => {
      const filePath = await createTemplate("custom", undefined, localRoot);
      expect(await storage.exists(filePath)).toBe(true);
      const content = await storage.readFile(filePath);
      expect(content).toContain('title: ""');
    });

    test("creates template with custom content", async () => {
      const content = "# Custom Template\n\n{{title}}\n";
      await createTemplate("custom", content, localRoot);
      const result = await readTemplate("custom", [
        { scope: "local", root: localRoot },
      ]);
      expect(result!.content).toBe(content);
    });
  });

  describe("expandTemplate", () => {
    test("expands all variables", () => {
      const tpl = "Title: {{title}}, Date: {{date}}, DT: {{datetime}}, Folder: {{folder}}";
      const vars = {
        title: "Test",
        date: "2026-02-15",
        datetime: "2026-02-15T10:00:00Z",
        folder: "notes",
      };
      const result = expandTemplate(tpl, vars);
      expect(result).toBe(
        "Title: Test, Date: 2026-02-15, DT: 2026-02-15T10:00:00Z, Folder: notes",
      );
    });

    test("leaves unknown variables as-is", () => {
      const result = expandTemplate("{{title}} {{unknown}}", {
        title: "Test",
      });
      expect(result).toBe("Test {{unknown}}");
    });

    test("expands multiple occurrences", () => {
      const result = expandTemplate("{{title}} - {{title}}", {
        title: "Hello",
      });
      expect(result).toBe("Hello - Hello");
    });
  });

  describe("buildTemplateVariables", () => {
    test("builds standard variables", () => {
      const vars = buildTemplateVariables("My Title", "notes");
      expect(vars.title).toBe("My Title");
      expect(vars.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(vars.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(vars.folder).toBe("notes");
    });

    test("defaults folder to empty string", () => {
      const vars = buildTemplateVariables("My Title");
      expect(vars.folder).toBe("");
    });
  });
});
