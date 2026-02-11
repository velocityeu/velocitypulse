import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { createRequire } from "module";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");
const agentPkgVersion = (() => {
  try {
    const agentPkg = require("../velocitypulse-agent/package.json");
    return typeof agentPkg.version === "string" ? agentPkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  (() => {
    try {
      return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
      return "dev";
    }
  })();

const latestAgentVersion =
  agentPkgVersion !== "0.0.0"
    ? agentPkgVersion
    : process.env.LATEST_AGENT_VERSION ??
      process.env.NEXT_PUBLIC_LATEST_AGENT_VERSION ??
      "0.0.0";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_ID: buildId,
    LATEST_AGENT_VERSION: latestAgentVersion,
    NEXT_PUBLIC_LATEST_AGENT_VERSION: latestAgentVersion,
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.SENTRY_AUTH_TOKEN,
});
