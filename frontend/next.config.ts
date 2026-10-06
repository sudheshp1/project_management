import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // The FastAPI backend serves /api in production; proxy to it during development.
    return {
      rewrites: async () => [
        {
          source: "/api/:path*",
          destination: `${process.env.BACKEND_URL ?? "http://127.0.0.1:8000"}/api/:path*`,
        },
      ],
    };
  }
  return { output: "export" };
};

export default nextConfig;
