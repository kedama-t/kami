/** Single scope identifier */
export type Scope = "local" | "global";

/** Scope option including "all" for queries */
export type ScopeOption = Scope | "all";

/** Operation type for scope auto-resolution */
export type OperationType = "read" | "write";

/** Resolved paths for a given scope */
export interface ScopePaths {
  /** Root directory of the scope (e.g. ~/.kami or ./.kami) */
  root: string;
  /** Vault directory for articles */
  vault: string;
  /** Templates directory */
  templates: string;
  /** Metadata index file path */
  indexFile: string;
  /** Link graph file path */
  linksFile: string;
  /** Config file path */
  configFile: string;
  /** Hooks config file path */
  hooksFile: string;
}
