/** kami configuration (config.json) */
export interface KamiConfig {
  server?: {
    port?: number;
  };
  build?: {
    outDir?: string;
  };
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
