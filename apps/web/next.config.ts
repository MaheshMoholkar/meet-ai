import type { NextConfig } from "next";

// The whole stack (web, worker, agent, speech) shares one .env at the repository
// root; every tool here runs from apps/web. Existing variables are never overridden.
try {
  process.loadEnvFile("../../.env");
} catch {
  // No .env file: rely on the process environment (CI, containers).
}

const nextConfig: NextConfig = {
  // E2E runs its own dev server next to `pnpm dev`; a separate build dir avoids
  // Next's one-dev-server-per-directory lock.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Self-contained server bundle for the Docker image (Dockerfile).
  output: "standalone",
  async redirects() {
    return [{ source: "/", destination: "/meetings", permanent: false }];
  },
};

export default nextConfig;
