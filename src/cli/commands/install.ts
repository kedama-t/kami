import { defineCommand } from "citty";
import {
  installSkill,
  INSTALL_TARGETS,
  INSTALL_LEVELS,
  TARGET_LABELS,
  type InstallTarget,
  type InstallLevel,
} from "../../core/installer.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";
import { jsonSuccess, handleError } from "../helpers/output.ts";

const TARGET_OPTIONS = INSTALL_TARGETS.map(
  (t, i) => `[${i + 1}] ${TARGET_LABELS[t]}`,
).join("  ");
const LEVEL_OPTIONS = INSTALL_LEVELS.map(
  (l, i) => `[${i + 1}] ${l}`,
).join("  ");

/** Line-buffered stdin reader that handles chunked input */
class LineReader {
  private buffer = "";
  private reader: ReadableStreamDefaultReader<Uint8Array>;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async readLine(): Promise<string> {
    while (!this.buffer.includes("\n")) {
      const { value, done } = await this.reader.read();
      if (done) break;
      this.buffer += Buffer.from(value).toString("utf-8");
    }
    const idx = this.buffer.indexOf("\n");
    if (idx === -1) {
      const line = this.buffer.trim();
      this.buffer = "";
      return line;
    }
    const line = this.buffer.slice(0, idx).trim();
    this.buffer = this.buffer.slice(idx + 1);
    return line;
  }

  releaseLock() {
    this.reader.releaseLock();
  }
}

export default defineCommand({
  meta: {
    name: "install",
    description: "Install kami skill for AI coding tools",
  },
  args: {
    target: {
      type: "string",
      alias: "t",
      description: "Target tool (claude-code, codex, gemini)",
    },
    level: {
      type: "string",
      alias: "l",
      description: "Install level (project, user)",
    },
    force: {
      type: "boolean",
      alias: "F",
      default: false,
      description: "Overwrite existing installation",
    },
    json: {
      type: "boolean",
      alias: "j",
      default: false,
      description: "Output as JSON",
    },
    quiet: {
      type: "boolean",
      alias: "q",
      default: false,
      description: "Suppress output",
    },
  },
  async run({ args }) {
    try {
      let target = args.target as InstallTarget | undefined;
      let level = args.level as InstallLevel | undefined;

      // Validate provided values
      if (target && !INSTALL_TARGETS.includes(target)) {
        throw new KamiError(
          `Invalid target: ${target}. Must be one of: ${INSTALL_TARGETS.join(", ")}`,
          "VALIDATION_ERROR",
          EXIT_CODES.GENERAL_ERROR,
        );
      }

      if (level && !INSTALL_LEVELS.includes(level)) {
        throw new KamiError(
          `Invalid level: ${level}. Must be one of: ${INSTALL_LEVELS.join(", ")}`,
          "VALIDATION_ERROR",
          EXIT_CODES.GENERAL_ERROR,
        );
      }

      // In JSON mode, both flags are required
      if (args.json && (!target || !level)) {
        throw new KamiError(
          "--target and --level are required in JSON mode",
          "VALIDATION_ERROR",
          EXIT_CODES.GENERAL_ERROR,
        );
      }

      // Interactive prompts for missing options
      let lineReader: LineReader | null = null;
      if (!target || !level) {
        lineReader = new LineReader(Bun.stdin.stream());
      }

      if (!target && lineReader) {
        process.stdout.write(`Target tool:  ${TARGET_OPTIONS}\n> `);
        const answer = await lineReader.readLine();
        const idx = parseInt(answer, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= INSTALL_TARGETS.length) {
          lineReader.releaseLock();
          throw new KamiError(
            "Invalid selection",
            "VALIDATION_ERROR",
            EXIT_CODES.GENERAL_ERROR,
          );
        }
        target = INSTALL_TARGETS[idx];
      }

      if (!level && lineReader) {
        process.stdout.write(`Install level:  ${LEVEL_OPTIONS}\n> `);
        const answer = await lineReader.readLine();
        const idx = parseInt(answer, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= INSTALL_LEVELS.length) {
          lineReader.releaseLock();
          throw new KamiError(
            "Invalid selection",
            "VALIDATION_ERROR",
            EXIT_CODES.GENERAL_ERROR,
          );
        }
        level = INSTALL_LEVELS[idx];
      }

      if (lineReader) {
        lineReader.releaseLock();
      }

      const result = await installSkill(
        target!,
        level!,
        process.cwd(),
        args.force,
      );

      if (args.quiet) return;

      if (args.json) {
        console.log(jsonSuccess(result));
      } else {
        const label = TARGET_LABELS[result.target];
        console.log(`Installed kami skill for ${label} (${result.level})`);
        for (const file of result.files) {
          console.log(`  ${file}`);
        }
      }
    } catch (err) {
      handleError(err, args.json);
    }
  },
});
