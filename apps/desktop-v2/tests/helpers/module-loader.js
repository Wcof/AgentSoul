/**
 * Loads pure functions from main.ts by using esbuild to strip types
 * and remove side-effect code, then evaluates in a sandboxed context.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { transform } from "esbuild";

const appRoot = new URL("../..", import.meta.url).pathname;

function readAreaSources() {
  let combined = "";
  const areasDir = join(appRoot, "src", "areas");
  for (const area of readdirSync(areasDir)) {
    const areaPath = join(areasDir, area);
    if (!statSync(areaPath).isDirectory()) continue;
    for (const file of readdirSync(areaPath)) {
      if (file.endsWith(".ts")) combined += readFileSync(join(areaPath, file), "utf8") + "\n";
    }
  }
  const sharedDir = join(appRoot, "src", "shared");
  for (const file of readdirSync(sharedDir)) {
    if (file.endsWith(".ts")) combined += readFileSync(join(sharedDir, file), "utf8") + "\n";
  }
  // Also include data directory (defaultSnapshot, etc.)
  const dataDir = join(appRoot, "src", "data");
  try {
    for (const file of readdirSync(dataDir)) {
      if (file.endsWith(".ts")) combined += readFileSync(join(dataDir, file), "utf8") + "\n";
    }
  } catch {}
  return combined;
}

export async function loadPureFunctions() {
  const typesPath = join(appRoot, "src", "types.ts");
  const canvasRendererPath = join(appRoot, "src", "canvas-renderer.ts");

  let source = [
    readFileSync(typesPath, "utf8"),
    readAreaSources(),
    readFileSync(canvasRendererPath, "utf8"),
  ].join("\n");

  // Strip ALL import statements (since everything is concatenated into one scope)
  // Multi-line imports: import type {\n  ...\n} from "...";
  source = source.replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+["'][^"']*["'];?\s*/g, "");
  // Default imports: import foo from "...";
  source = source.replace(/import\s+\w+\s+from\s+["'][^"']*["'];?\s*/g, "");
  // Side-effect imports: import "...";
  source = source.replace(/import\s+["'][^"']*["'];?\s*/g, "");
  // Dynamic import() calls - replace with a no-op
  source = source.replace(/await\s+import\(["'][^"']*["']\)/g, "({})");

  // Strip the DOM side-effect bootstrap at the bottom of the file
  source = source.replace(
    /const\s+app\s*=\s*document\.querySelector[\s\S]*$/,
    "// bootstrap stripped for testing",
  );

  // Transpile TypeScript to JS using esbuild (ESM keeps export declarations)
  const result = await transform(source, {
    loader: "ts",
    format: "esm",
    target: "es2022",
  });

  // Convert ESM exports to local declarations, then add a return statement
  let code = result.code;
  const exportedNames = [];

  // Strip any remaining import statements from esbuild output
  code = code.replace(/^import\s+.*$/gm, "");
  code = code.replace(/^import\s+\{[\s\S]*?\}\s+from\s+["'][^"']*["'];?$/gm, "");

  // Match: export function name(...)  →  function name(...)
  // Match: export const name = ...    →  const name = ...
  // Match: export { a, b, c };        →  (collect names for return)
  code = code.replace(/^export\s+function\s+/gm, () => { exportedNames.push("__FUNC__"); return "function "; });
  code = code.replace(/^export\s+const\s+(\w+)/gm, (_, name) => { exportedNames.push(name); return `const ${name}`; });
  code = code.replace(/^export\s+\{([^}]+)\}\s*;?\s*$/gm, (_, names) => {
    for (const n of names.split(",")) {
      const trimmed = n.trim().split(/\s+as\s+/)[0].trim();
      if (trimmed) exportedNames.push(trimmed);
    }
    return "";
  });

  // Fix function names: we pushed "__FUNC__" but need to extract the actual name
  // Re-extract exported function names from the transpiled code
  const funcNames = [...code.matchAll(/^function\s+(\w+)/gm)].map(m => m[1]);

  // Minimal document mock for code that references document
  const mockDocument = {
    createElement: () => ({ innerHTML: "", addEventListener: () => {} }),
    createDocumentFragment: () => ({ childNodes: [] }),
    querySelector: () => null,
  };

  // Collect all top-level function names for the return object
  const returnNames = [
    "renderCompanionViewModel",
    "resolveVisualState",
    "renderAgentSoulShell",
    "renderDesktopCompanionWidget",
    "createDesktopCompanionController",
    "defaultCompanionSnapshot",
    "t",
    "escapeHtml",
    "faceForState",
    "labelForInteraction",
    "formatMix",
    "formatNumber",
    "formatBytes",
    "errorMessage",
    "renderControlCenterTaskNavigation",
    "renderCompanionArea",
    "renderGatewayArea",
    "renderCostsArea",
    "renderSkillsArea",
    "renderSessionsArea",
    "renderConversationsArea",
    "renderSafetyArea",
    "renderSettingsArea",
    "renderSettingsFullArea",
    "renderSessionsMgrArea",
    "renderMcpArea",
    "renderPromptsArea",
    "renderApprovalRequired",
    "renderRiskNotices",
    "renderDashboardStatsBar",
    "renderActivityWaveform",
    "renderKeyTrendChart",
    "renderModelStatsChart",
    "renderAppSwitcher",
    "renderUsageFooter",
    "renderConversationDashboard",
    "renderFullSettingsArea",
    "renderDeepLinkImportDialog",
  ];

  const returnStmt = `return { ${returnNames.map(n => n).join(", ")} };`;
  const wrappedCode = `(function(document) {\n${code}\n${returnStmt}\n})`;

  const fn = eval(wrappedCode);
  return fn(mockDocument);
}
