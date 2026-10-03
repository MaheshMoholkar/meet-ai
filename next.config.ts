import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs its own dev server next to `pnpm dev`; a separate build dir avoids
  // Next's one-dev-server-per-directory lock.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async redirects() {
    return [{ source: "/", destination: "/meetings", permanent: false }];
  },
};

export default nextConfig;
