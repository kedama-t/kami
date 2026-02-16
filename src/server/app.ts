import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { apiRoutes } from "./routes/api.ts";
import { pageRoutes } from "./routes/pages.ts";

export function createApp(distDir: string) {
  const app = new Hono();

  // API routes (highest priority)
  app.route("/api", apiRoutes);

  // SSR page routes (/new, /search, /articles/:scope/:slug/edit)
  app.route("/", pageRoutes);

  // Static file serving from dist/ (fallback)
  app.use("/*", serveStatic({ root: distDir }));

  return app;
}
