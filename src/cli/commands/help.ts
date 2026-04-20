import { defineCommand } from "citty";
import pkg from "../../../package.json";
import { buildCatalog } from "../helpers/catalog.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

export default defineCommand({
  meta: {
    name: "help",
    description: "Show command catalog (use --json for machine-readable output)",
  },
  args: {
    json: {
      type: "boolean",
      alias: "j",
      default: false,
      description: "Output as compact JSON catalog",
    },
  },
  async run({ args }) {
    try {
      // 動的インポートで循環参照を回避（main.ts 側で help を subCommand として参照しているため）
      const { main } = await import("../main.ts");
      const catalog = await buildCatalog(main, pkg.version);

      if (args.json) {
        console.log(jsonSuccess(catalog));
        return;
      }

      console.log(`${catalog.name} ${catalog.version}`);
      if (catalog.description) console.log(catalog.description);
      console.log("");
      console.log("Commands:");
      for (const cmd of catalog.commands) {
        if (cmd.name === "help") continue;
        console.log(`  ${cmd.name.padEnd(12)} ${cmd.description ?? ""}`);
        if (cmd.subCommands) {
          for (const sub of cmd.subCommands) {
            console.log(`    ${sub.name.padEnd(10)} ${sub.description ?? ""}`);
          }
        }
      }
      console.log("");
      console.log("Run 'kami <command> --help' for command-specific options.");
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
