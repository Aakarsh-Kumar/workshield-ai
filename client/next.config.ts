import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "http://backend:4000");

const aiServiceUrl =
  process.env.AI_SERVICE_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:5001" : "http://ai-service:5001");

const nextConfig: NextConfig = {
  // Required for optimised Docker image (copies only what's needed to run)
  output: "standalone",

  // Prevent Turbopack from inferring the parent monorepo root.
  // This app is built and deployed from the client/ directory.
  turbopack: {
    root: __dirname,
  },

  // Keep browser traffic same-origin in both local and Docker runs.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/ai/:path*",
        destination: `${aiServiceUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
