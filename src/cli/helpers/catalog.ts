import type { CommandDef, ArgsDef, ArgDef, SubCommandsDef, Resolvable, CommandMeta } from "citty";

export interface CatalogArg {
  name: string;
  type: string;
  positional?: boolean;
  required?: boolean;
  alias?: string[];
  default?: unknown;
  description?: string;
}

export interface CatalogCommand {
  name: string;
  description?: string;
  args: CatalogArg[];
  subCommands?: CatalogCommand[];
}

export interface Catalog {
  name: string;
  version: string;
  description?: string;
  commands: CatalogCommand[];
}

async function resolve<T>(v: Resolvable<T> | undefined): Promise<T | undefined> {
  if (v === undefined) return undefined;
  if (typeof v === "function") return await (v as () => T | Promise<T>)();
  return await v;
}

async function buildArgs(argsDef: ArgsDef): Promise<CatalogArg[]> {
  const out: CatalogArg[] = [];
  for (const [name, def] of Object.entries(argsDef) as [string, ArgDef][]) {
    if (!def) continue;
    const a: CatalogArg = { name, type: def.type ?? "string" };
    if (def.type === "positional") a.positional = true;
    if (def.required) a.required = true;
    if ("alias" in def && def.alias) {
      a.alias = Array.isArray(def.alias) ? def.alias : [def.alias];
    }
    if ("default" in def && def.default !== undefined) a.default = def.default;
    if (def.description) a.description = def.description;
    out.push(a);
  }
  return out;
}

async function buildCommands(subDef: SubCommandsDef): Promise<CatalogCommand[]> {
  const out: CatalogCommand[] = [];
  for (const [name, sub] of Object.entries(subDef)) {
    const cmd = await resolve<CommandDef>(sub);
    if (!cmd) continue;
    const meta = (await resolve<CommandMeta>(cmd.meta)) ?? {};
    if (meta.hidden) continue;
    const args = (await resolve<ArgsDef>(cmd.args)) ?? {};
    const subs = (await resolve<SubCommandsDef>(cmd.subCommands)) ?? {};
    const entry: CatalogCommand = {
      name,
      description: meta.description,
      args: await buildArgs(args),
    };
    const nested = await buildCommands(subs);
    if (nested.length > 0) entry.subCommands = nested;
    out.push(entry);
  }
  return out;
}

/** citty CommandDef を再帰走査して compact JSON catalog を生成 */
export async function buildCatalog(
  rootCmd: CommandDef,
  version: string,
): Promise<Catalog> {
  const meta = (await resolve<CommandMeta>(rootCmd.meta)) ?? {};
  const subs = (await resolve<SubCommandsDef>(rootCmd.subCommands)) ?? {};
  return {
    name: meta.name ?? "kami",
    version,
    description: meta.description,
    commands: await buildCommands(subs),
  };
}
