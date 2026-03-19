const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function safeGit(command) {
  try {
    return execSync(command, {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch (err) {
    return "";
  }
}

function clean(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

const gitSha =
  clean(process.env.REACT_APP_BUILD_SHA, "") ||
  clean(process.env.VERCEL_GIT_COMMIT_SHA, "") ||
  clean(process.env.GIT_COMMIT, "") ||
  safeGit("git rev-parse --short HEAD") ||
  "unknown";

const gitBranch =
  clean(process.env.REACT_APP_BUILD_BRANCH, "") ||
  clean(process.env.VERCEL_GIT_COMMIT_REF, "") ||
  safeGit("git rev-parse --abbrev-ref HEAD") ||
  "unknown";

const buildTime =
  clean(process.env.REACT_APP_BUILD_TIME, "") || new Date().toISOString();

const source =
  "export const BUILD_INFO = " +
  JSON.stringify(
    {
      sha: gitSha,
      branch: gitBranch,
      builtAt: buildTime,
    },
    null,
    2
  ) +
  ";\n";

fs.writeFileSync(path.resolve(__dirname, "..", "src", "buildInfo.js"), source);
