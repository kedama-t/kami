/** Hook event names */
export type HookEvent =
  | "article:pre-create"
  | "article:post-create"
  | "article:pre-update"
  | "article:post-update"
  | "article:pre-delete"
  | "article:post-delete"
  | "build:pre"
  | "build:post";

/** A single hook handler */
export interface HookHandler {
  type: "command";
  command: string;
  timeout?: number; // seconds, default 30
}

/** A matcher group with its hooks */
export interface HookMatcherGroup {
  matcher?: string; // regex pattern (optional)
  hooks: HookHandler[];
}

/** Top-level hooks configuration (hooks.json) */
export interface HookConfig {
  hooks: Partial<Record<HookEvent, HookMatcherGroup[]>>;
}

/** Context passed to hooks via stdin and variable expansion */
export interface HookContext {
  event: HookEvent;
  timestamp: string;
  scope: string;
  vault_path: string;
  // article:* events
  slug?: string;
  title?: string;
  file_path?: string;
  folder?: string;
  tags?: string[];
}

/** Hook stdout JSON response */
export interface HookResponse {
  continue?: boolean;
  message?: string;
}

/** Empty hooks config */
export const EMPTY_HOOK_CONFIG: HookConfig = {
  hooks: {},
};
