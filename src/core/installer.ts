import { join } from "node:path";
import { homedir } from "node:os";
import { LocalStorage } from "../storage/local.ts";
import { KamiError, EXIT_CODES } from "../types/result.ts";

const storage = new LocalStorage();

export type InstallTarget = "claude-code" | "codex" | "gemini";
export type InstallLevel = "project" | "user";

export const INSTALL_TARGETS: InstallTarget[] = [
  "claude-code",
  "codex",
  "gemini",
];
export const INSTALL_LEVELS: InstallLevel[] = ["project", "user"];

export const TARGET_LABELS: Record<InstallTarget, string> = {
  "claude-code": "Claude Code",
  codex: "Codex CLI",
  gemini: "Gemini CLI",
};

/** Tool-specific config directory name */
const TARGET_DIR: Record<InstallTarget, string> = {
  "claude-code": ".claude",
  codex: ".codex",
  gemini: ".gemini",
};

export interface InstallResult {
  target: InstallTarget;
  level: InstallLevel;
  files: string[];
  destination: string;
}

/** Get the skill source directory from the package root */
function getSkillSourceDir(): string {
  // src/core/ -> src/ -> package root -> .claude/skills/kami/
  return join(import.meta.dir, "..", "..", ".claude", "skills", "kami");
}

/** Get the destination skill directory for any target */
function getDestination(
  target: InstallTarget,
  level: InstallLevel,
  cwd: string,
): string {
  const base =
    level === "project" ? cwd : homedir();
  return join(base, TARGET_DIR[target], "skills", "kami");
}

/** Copy the skill directory to the destination */
async function copySkillDir(
  target: InstallTarget,
  level: InstallLevel,
  cwd: string,
  force: boolean,
): Promise<InstallResult> {
  const dest = getDestination(target, level, cwd);
  const skillMd = join(dest, "SKILL.md");

  if (!force && (await storage.exists(skillMd))) {
    throw new KamiError(
      `Skill already exists at ${dest}. Use --force to overwrite.`,
      "VALIDATION_ERROR",
      EXIT_CODES.GENERAL_ERROR,
    );
  }

  const srcDir = getSkillSourceDir();

  if (!(await storage.exists(join(srcDir, "SKILL.md")))) {
    throw new KamiError(
      `Skill source not found at ${srcDir}. Package may be incomplete.`,
      "IO_ERROR",
      EXIT_CODES.GENERAL_ERROR,
    );
  }

  const files: string[] = [];

  // Create directory structure
  await storage.mkdir(dest);
  await storage.mkdir(join(dest, "reference"));

  // Copy SKILL.md
  const content = await storage.readFile(join(srcDir, "SKILL.md"));
  await storage.writeFile(skillMd, content);
  files.push(skillMd);

  // Copy reference files
  const refDir = join(srcDir, "reference");
  const refFiles = await storage.listFiles(refDir, "*.md");
  for (const refFile of refFiles) {
    const name = refFile.split("/").pop()!;
    const destFile = join(dest, "reference", name);
    const refContent = await storage.readFile(refFile);
    await storage.writeFile(destFile, refContent);
    files.push(destFile);
  }

  return { target, level, files, destination: dest };
}

/** Install kami skill for the given target and level */
export async function installSkill(
  target: InstallTarget,
  level: InstallLevel,
  cwd: string,
  force: boolean,
): Promise<InstallResult> {
  return copySkillDir(target, level, cwd, force);
}
