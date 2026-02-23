/** kami configuration (config.json) */
export interface KamiConfig {
  server?: {
    port?: number;
  };
  build?: {
    outDir?: string;
  };
  /** Named vault registry: name -> absolute path to vault directory */
  vaults?: Record<string, string>;
  /** Active vault name (defaults to "default" which uses ~/.kami/vault) */
  activeVault?: string;
}

/** Default global config */
export const DEFAULT_CONFIG: KamiConfig = {
  server: {
    port: 3000,
  },
  build: {
    outDir: "dist",
  },
};
