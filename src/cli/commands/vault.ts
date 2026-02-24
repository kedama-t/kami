import { defineCommand } from "citty";
import { resolve } from "node:path";
import {
  listVaults,
  addVault,
  removeVault,
  useVault,
} from "../../core/vault.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

const listCmd = defineCommand({
  meta: {
    name: "list",
    description: "List registered vaults",
  },
  args: {
    json: {
      type: "boolean",
      alias: "j",
      default: false,
      description: "Output as JSON",
    },
  },
  async run({ args }) {
    try {
      const vaults = await listVaults();

      if (args.json) {
        console.log(jsonSuccess({ vaults }));
        return;
      }

      console.log(` ${"NAME".padEnd(16)} ${"PATH".padEnd(50)} ACTIVE`);
      for (const v of vaults) {
        console.log(
          ` ${v.name.padEnd(16)} ${v.path.padEnd(50)} ${v.active ? "*" : ""}`,
        );
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});

const addCmd = defineCommand({
  meta: {
    name: "add",
    description: "Register a new vault directory",
  },
  args: {
    name: {
      type: "positional",
      description: "Vault name",
      required: true,
    },
    path: {
      type: "positional",
      description: "Absolute or relative path to the vault directory",
      required: true,
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
      const absPath = resolve(args.path);
      await addVault(args.name, absPath);

      if (args.json) {
        console.log(jsonSuccess({ name: args.name, path: absPath }));
        return;
      }

      console.log(`Vault '${args.name}' registered at ${absPath}`);
    } catch (err) {
      handleError(err, args.json);
    }
  },
});

const removeCmd = defineCommand({
  meta: {
    name: "remove",
    description: "Remove a vault from the registry",
  },
  args: {
    name: {
      type: "positional",
      description: "Vault name",
      required: true,
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
      const { path } = await removeVault(args.name);

      if (args.json) {
        console.log(
          jsonSuccess({
            removed: args.name,
            path,
            warning:
              "Files on disk were not deleted. If this was the active vault, kami has fallen back to the default vault.",
          }),
        );
        return;
      }

      console.warn(
        `Warning: Vault '${args.name}' has been removed from the registry. ` +
          `Files at ${path} were not deleted. ` +
          `If this was the active vault, kami will use the default vault.`,
      );
    } catch (err) {
      handleError(err, args.json);
    }
  },
});

const useCmd = defineCommand({
  meta: {
    name: "use",
    description: "Switch the active vault",
  },
  args: {
    name: {
      type: "positional",
      description: "Vault name",
      required: true,
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
      const path = await useVault(args.name);

      if (args.json) {
        console.log(jsonSuccess({ activeVault: args.name, path }));
        return;
      }

      console.log(`Switched to vault '${args.name}' at ${path}`);
      console.log(
        `Tip: Run 'kami reindex --scope global' to rebuild the search index for this vault.`,
      );
    } catch (err) {
      handleError(err, args.json);
    }
  },
});

export default defineCommand({
  meta: {
    name: "vault",
    description: "Manage vaults (context switching for global scope)",
  },
  subCommands: {
    list: listCmd,
    add: addCmd,
    remove: removeCmd,
    use: useCmd,
  },
});
