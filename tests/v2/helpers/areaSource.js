/**
 * Helper for contract tests — reads area module source files.
 * After the Issue #114 split, render functions live in areas/<name>/render.ts
 * instead of the monolithic renderers.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appSrc = (root, ...parts) => join(root, "apps", "desktop-v2", "src", ...parts);

/** Read all area render sources concatenated (for backward-compat pattern checks) */
export function readAllAreaSources(root) {
  const areas = ["companion", "gateway", "costs", "skills", "sessions", "conversations", "safety", "settings", "settings-full", "sessions-mgr", "mcp", "prompts"];
  const shared = ["shell", "nav", "app-switcher", "usage-footer"];
  let combined = "";
  for (const area of areas) {
    try { combined += readFileSync(appSrc(root, "areas", area, "render.ts"), "utf8") + "\n"; } catch {}
    try { combined += readFileSync(appSrc(root, "areas", area, "bind.ts"), "utf8") + "\n"; } catch {}
  }
  for (const s of shared) {
    try { combined += readFileSync(appSrc(root, "shared", s + ".ts"), "utf8") + "\n"; } catch {}
  }
  // Also include the barrel file
  try { combined += readFileSync(appSrc(root, "renderers.ts"), "utf8") + "\n"; } catch {}
  try { combined += readFileSync(appSrc(root, "controller.ts"), "utf8") + "\n"; } catch {}
  return combined;
}

/** Read a specific area render source */
export function readAreaSource(root, area) {
  return readFileSync(appSrc(root, "areas", area, "render.ts"), "utf8");
}

/** Read a specific area bind source */
export function readAreaBindSource(root, area) {
  return readFileSync(appSrc(root, "areas", area, "bind.ts"), "utf8");
}
