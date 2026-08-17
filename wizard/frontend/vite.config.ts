import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Surfaced in the UI (see BuildBadge in App.tsx) so "did my update actually
// arrive" is answerable from a screenshot instead of guesswork - deployment
// confusion has repeatedly derailed debugging real, unrelated bugs.
function readAddonVersion(): string {
  try {
    const text = readFileSync(new URL("../config.yaml", import.meta.url), "utf-8");
    return text.match(/^version:\s*"([^"]+)"/m)?.[1] ?? "?";
  } catch { return "?"; }
}
function readBuildSha(): string {
  try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "?"; }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(readAddonVersion()),
    __BUILD_SHA__: JSON.stringify(readBuildSha()),
  },
});
