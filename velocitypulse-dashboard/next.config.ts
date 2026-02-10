import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { createRequire } from "module";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  (() => {
    try {
      return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
      return "dev";
    }
  })();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.SENTRY_AUTH_TOKEN,
});
