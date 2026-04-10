import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.1.0",
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  serverExternalPackages: ["@react-pdf/renderer", "playwright", "playwright-core", "mammoth", "@sendgrid/mail"],
  turbopack: {
    resolveAlias: {
      canvas: "./src/empty-module.ts",
    },
  },
};

export default nextConfig;
