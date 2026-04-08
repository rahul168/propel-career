import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "playwright", "playwright-core", "mammoth"],
  turbopack: {
    resolveAlias: {
      canvas: "./src/empty-module.ts",
    },
  },
};

export default nextConfig;
