import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for optimised Docker image (copies only what's needed to run)
  output: "standalone",

  // Prevent Turbopack from inferring the parent monorepo root.
  // This app is built and deployed from the client/ directory.
  turbopack: {
    root: __dirname,
  },

  // Development proxy rewrites so `next dev` works without Docker/NGINX.
  // In production, NGINX handles /api and /ai routing.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/:path*`,
      },
      {
        source: "/ai/:path*",
        destination: `${process.env.AI_SERVICE_URL ?? "http://localhost:5001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
