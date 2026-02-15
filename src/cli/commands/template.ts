import { defineCommand } from "citty";
import {
  listTemplates,
  readTemplate,
  createTemplate,
} from "../../core/template.ts";
import {
  resolveScope,
  getScopeRoot,
} from "../../core/scope.ts";
import type { Scope, ScopeOption } from "../../types/scope.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";
import { readBody } from "../helpers/input.ts";

const listCmd = defineCommand({
  meta: {
    name: "list",
    description: "List available templates",
  },
  args: {
    scope: {
      type: "string",
      alias: "s",
      default: "all",
      description: "Scope: local, global, or all",
    },
    json: {
      type: "boolean",
      alias: "j",
      default: false,
      description: "Output as JSON",
    },
  },
  async run({ args }) {
    try {
      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as ScopeOption,
        "read",
      );

      const scopeRoots = scopes.map((s) => ({
        scope: s,
        root: s === "local" ? localRoot! : globalRoot,
      }));

      const templates = await listTemplates(scopeRoots);

      if (args.json) {
        console.log(
          jsonSuccess({
            templates: templates.map((t) => ({
              name: t.name,
              scope: t.scope,
            })),
          }),
        );
        return;
      }

      if (templates.length === 0) {
        console.log("No templates found.");
        return;
      }

      console.log(` ${"SCOPE".padEnd(8)} NAME`);
      for (const t of templates) {
        console.log(` ${t.scope.padEnd(8)} ${t.name}`);
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});

const showCmd = defineCommand({
  meta: {
    name: "show",
    description: "Show template content",
  },
  args: {
    name: {
      type: "positional",
      description: "Template name",
      required: true,
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Target scope",
    },
    json: {
      type: "boolean",
      alias: "j",
      default: false,
      description: "Output as JSON",
    },
  },
  async run({ args }) {
    try {
      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as ScopeOption | undefined,
        "read",
      );

      const scopeRoots = scopes.map((s) => ({
        scope: s,
        root: s === "local" ? localRoot! : globalRoot,
      }));

      const tpl = await readTemplate(args.name, scopeRoots);
      if (!tpl) {
        throw new KamiError(
          `Template '${args.name}' not found`,
          "TEMPLATE_NOT_FOUND",
          EXIT_CODES.NOT_FOUND,
        );
      }

      if (args.json) {
        console.log(
          jsonSuccess({
            name: args.name,
            scope: tpl.scope,
            content: tpl.content,
          }),
        );
        return;
      }

      console.log(tpl.content);
    } catch (err) {
      handleError(err, args.json);
    }
  },
});

const createCmd = defineCommand({
  meta: {
    name: "create",
    description: "Create a new template",
  },
  args: {
    name: {
      type: "positional",
      description: "Template name",
      required: true,
    },
    scope: {
      type: "string",
      alias: "s",
      description: "Target scope",
    },
    body: {
      type: "string",
      alias: "b",
      description: "Template content (file path or '-' for stdin)",
    },
    json: {
      type: "boolean",
      alias: "j",
      default: false,
      description: "Output as JSON",
    },
  },
  async run({ args }) {
    try {
      const { scopes, localRoot, globalRoot } = await resolveScope(
        args.scope as Scope | undefined,
        "write",
      );
      const targetScope = scopes[0]!;
      const root = targetScope === "local" ? localRoot! : globalRoot;

      let content: string | undefined;
      if (args.body) {
        content = await readBody(args.body);
      }

      const filePath = await createTemplate(args.name, content, root);

      if (args.json) {
        console.log(
          jsonSuccess({
            name: args.name,
            scope: targetScope,
            file_path: filePath,
          }),
        );
        return;
      }

      console.log(`Created template: ${args.name} (${targetScope})`);
    } catch (err) {
      handleError(err, args.json);
    }
  },
});

export default defineCommand({
  meta: {
    name: "template",
    description: "Manage templates",
  },
  subCommands: {
    list: listCmd,
    show: showCmd,
    create: createCmd,
  },
});
