/**
 * Loads pure functions from main.ts by using esbuild to strip types
 * and remove side-effect code, then evaluates in a sandboxed context.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transform } from "esbuild";

const appRoot = new URL("../..", import.meta.url).pathname;

export async function loadPureFunctions() {
  const typesPath = join(appRoot, "src", "types.ts");
  const renderersPath = join(appRoot, "src", "renderers.ts");
  const canvasRendererPath = join(appRoot, "src", "canvas-renderer.ts");
  const controllerPath = join(appRoot, "src", "controller.ts");

  let source = [
    readFileSync(typesPath, "utf8"),
    readFileSync(renderersPath, "utf8"),
    readFileSync(canvasRendererPath, "utf8"),
    readFileSync(controllerPath, "utf8"),
  ].join("\n");

  // Strip relative imports (since everything is concatenated into one scope)
  source = source.replace(/import\s+[\s\S]*?\s+from\s+["']\.\/.*?["'];?/g, "");

  // Strip CSS import (causes errors outside browser)
  source = source.replace(/^import\s+["']\.\/styles\.css["'];?\s*$/m, "");

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
    "createDesktopCompanionController",
    "defaultCompanionSnapshot",
  ];

  const returnStmt = `return { ${returnNames.map(n => n).join(", ")} };`;
  const wrappedCode = `(function(document) {\n${code}\n${returnStmt}\n})`;

  const fn = eval(wrappedCode);
  return fn(mockDocument);
}
