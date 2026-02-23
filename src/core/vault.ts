import { join } from "node:path";
import { loadGlobalConfig, saveGlobalConfig, getGlobalRoot } from "./scope.ts";
import { LocalStorage } from "../storage/local.ts";
import { KamiError, EXIT_CODES } from "../types/result.ts";

const storage = new LocalStorage();

export const DEFAULT_VAULT_NAME = "default";

export interface VaultEntry {
  name: string;
  path: string;
  active: boolean;
}

/** List all registered vaults including the implicit default */
export async function listVaults(): Promise<VaultEntry[]> {
  const config = await loadGlobalConfig();
  const vaults = config.vaults ?? {};
  const activeVault = config.activeVault ?? DEFAULT_VAULT_NAME;
  const defaultPath = join(getGlobalRoot(), "vault");

  const entries: VaultEntry[] = [
    {
      name: DEFAULT_VAULT_NAME,
      path: defaultPath,
      active: activeVault === DEFAULT_VAULT_NAME,
    },
  ];

  for (const [name, path] of Object.entries(vaults)) {
    entries.push({ name, path, active: name === activeVault });
  }

  return entries;
}

/** Register a new named vault */
export async function addVault(name: string, path: string): Promise<void> {
  if (name === DEFAULT_VAULT_NAME) {
    throw new KamiError(
      `Cannot use reserved vault name '${DEFAULT_VAULT_NAME}'`,
      "VALIDATION_ERROR",
      EXIT_CODES.GENERAL_ERROR,
    );
  }

  const config = await loadGlobalConfig();
  const vaults = config.vaults ?? {};

  if (vaults[name]) {
    throw new KamiError(
      `Vault '${name}' already exists at ${vaults[name]}`,
      "VALIDATION_ERROR",
      EXIT_CODES.GENERAL_ERROR,
    );
  }

  await storage.mkdir(path);
  vaults[name] = path;
  await saveGlobalConfig({ ...config, vaults });
}

/** Remove a named vault from the registry (files on disk are NOT deleted) */
export async function removeVault(name: string): Promise<{ path: string }> {
  if (name === DEFAULT_VAULT_NAME) {
    throw new KamiError(
      `Cannot remove the default vault`,
      "VALIDATION_ERROR",
      EXIT_CODES.GENERAL_ERROR,
    );
  }

  const config = await loadGlobalConfig();
  const vaults = config.vaults ?? {};

  if (!vaults[name]) {
    throw new KamiError(
      `Vault '${name}' not found`,
      "VAULT_NOT_FOUND",
      EXIT_CODES.NOT_FOUND,
    );
  }

  const removedPath = vaults[name];
  delete vaults[name];

  // If the removed vault was active, fall back to default
  const activeVault =
    config.activeVault === name ? DEFAULT_VAULT_NAME : config.activeVault;

  await saveGlobalConfig({ ...config, vaults, activeVault });
  return { path: removedPath };
}

/** Switch the active vault */
export async function useVault(name: string): Promise<string> {
  const config = await loadGlobalConfig();

  if (name === DEFAULT_VAULT_NAME) {
    await saveGlobalConfig({ ...config, activeVault: DEFAULT_VAULT_NAME });
    return join(getGlobalRoot(), "vault");
  }

  const vaults = config.vaults ?? {};
  if (!vaults[name]) {
    throw new KamiError(
      `Vault '${name}' not found. Use 'kami vault add <name> <path>' to register it first.`,
      "VAULT_NOT_FOUND",
      EXIT_CODES.NOT_FOUND,
    );
  }

  await saveGlobalConfig({ ...config, activeVault: name });
  return vaults[name];
}
