import { defineCommand } from "citty";
import { initLocalScope, findLocalRoot } from "../../core/scope.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";
import { LocalStorage } from "../../storage/local.ts";

const storage = new LocalStorage();

export default defineCommand({
  meta: {
    name: "init",
    description: "Initialize a local kami scope in the current directory",
  },
  args: {
    force: {
      type: "boolean",
      default: false,
      description: "Overwrite existing .kami/ directory",
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
      const cwd = process.cwd();
      const existing = await findLocalRoot(cwd);

      if (existing && existing === `${cwd}/.kami` && !args.force) {
        throw new KamiError(
          `.kami/ already exists in ${cwd}. Use --force to reinitialize.`,
          "VALIDATION_ERROR",
          EXIT_CODES.GENERAL_ERROR,
        );
      }

      const root = await initLocalScope(cwd);

      if (args.json) {
        console.log(jsonSuccess({ path: root, scope: "local" }));
      } else {
        console.log(`Initialized kami local scope in ${root}`);
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
