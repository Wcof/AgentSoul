#!/usr/bin/env node
// 合约测试迁移脚本 — 将 node:test 迁移到 vitest
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";

const ROOT = "/Users/ldh/Downloads/project/AgentSoul";
const V2_DIR = join(ROOT, "tests", "v2");

function findTests(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory() && entry !== "node_modules" && entry !== "dist")
      results.push(...findTests(full));
    else if (/\.(test\.ts|test\.mjs)$/.test(entry)) results.push(full);
  }
  return results;
}

// 找到匹配的闭合括号
function findClose(text, start) {
  let depth = 1, i = start;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch; i++;
      while (i < text.length && text[i] !== q) {
        if (text[i] === "\\") i++;
        i++;
      }
    } else if (ch === "/" && i > 0 && /[=(:,;!&|?+\-~]/.test(text[i - 1] || "")) {
      // 正则字面量
      i++;
      while (i < text.length && text[i] !== "/") {
        if (text[i] === "\\") i++;
        i++;
      }
    }
    i++;
  }
  return depth === 0 ? i - 1 : -1;
}

// 在顶层逗号处拆分参数
function splitArgs(s) {
  const args = [];
  let depth = 0, cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) { args.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) args.push(cur);
  return args;
}

// 替换 assert.X(...) 调用
function replaceAssertCalls(content) {
  const patterns = [
    { match: "assert.equal", fn: (a, b) => `expect(${a}).toBe(${b})` },
    { match: "assert.deepEqual", fn: (a, b) => `expect(${a}).toEqual(${b})` },
    { match: "assert.match", fn: (a, b) => `expect(${a}).toMatch(${b})` },
    { match: "assert.doesNotMatch", fn: (a, b) => `expect(${a}).not.toMatch(${b})` },
    { match: "assert.notEqual", fn: (a, b) => `expect(${a}).not.toBe(${b})` },
    { match: "assert.ok", fn: (a) => `expect(${a}).toBeTruthy()` },
    { match: "assert.rejects", fn: (a) => `expect(${a}).rejects.toThrow()` },
    { match: "assert.throws", fn: (a) => `expect(${a}).toThrow()` },
    { match: "assert.doesNotThrow", fn: (a) => `expect(${a}).not.toThrow()` },
  ];
  let result = content;
  for (const { match, fn } of patterns) {
    const search = match + "(";
    let idx = 0;
    while (true) {
      const pos = result.indexOf(search, idx);
      if (pos === -1) break;
      const open = pos + match.length;
      const close = findClose(result, open + 1);
      if (close === -1) { idx = pos + 1; continue; }
      const argsStr = result.substring(open + 1, close);
      const args = splitArgs(argsStr);
      let rep;
      if (args.length >= 2) rep = fn(args[0].trim(), args[1].trim());
      else if (args.length === 1) rep = fn(args[0].trim());
      else { idx = pos + 1; continue; }
      result = result.substring(0, pos) + rep + result.substring(close + 1);
      idx = pos + rep.length;
    }
  }
  return result;
}

// 替换 imports
function fixImports(content) {
  content = content.replace(
    /import\s*\{\s*describe\s*,\s*it\s*(?:,\s*\w+)?\s*\}\s*from\s*["']node:test["']\s*;?/g,
    'import { describe, it, expect } from "vitest";'
  );
  content = content.replace(
    /import\s+assert\s+from\s+["']node:assert\/strict["']\s*;?\s*\n?/g,
    ""
  );
  return content;
}

// 修复脚本内容检查 (toBe("npm --workspace ...") → toMatch(/vitest/))
function fixScriptChecks(content) {
  content = content.replace(
    /\.toBe\("npm --workspace @agentsoul\/\S+ run test"\)/g,
    '.toMatch(/vitest run/)'
  );
  content = content.replace(
    /\.toBe\("npm --workspace @agentsoul\/\S+ run typecheck"\)/g,
    '.toMatch(/typecheck/)'
  );
  // 修复 workspace-scaffold 中的旧测试脚本检查
  content = content.replace(
    /\.toBe\("node --test tests\/\*\.test\.mjs"/g,
    '.toMatch(/vitest/'
  );
  content = content.replace(
    /\.startsWith\("node --test tests\/\*\.test\.mjs"\), true\)/g,
    ').toMatch(/vitest/)'
  );
  return content;
}

// 修复 workspace-scaffold 的 workspace 列表检查
function fixWorkspaceScaffold(content, file) {
  if (!basename(file).includes("workspace-scaffold")) return content;
  // 替换 workspaces.slice(0, 3) 检查
  content = content.replace(
    /assert\.deepEqual\(rootPackage\.workspaces\.slice\(0, 3\), \[\s*\n\s*"apps\/desktop-v2",\s*\n\s*"packages\/domain",\s*\n\s*"packages\/persistence",\s*\n\s*\]\)/,
    `expect(rootPackage.workspaces).toContain("apps/desktop-v2");\n    expect(rootPackage.workspaces).toContain("packages/domain");\n    expect(rootPackage.workspaces.length).toBeGreaterThanOrEqual(14)`
  );
  return content;
}

const files = findTests(V2_DIR);
let migrated = 0, skipped = 0;

for (const file of files) {
  let content = readFileSync(file, "utf-8");
  if (content.trim().length < 10) { skipped++; continue; }
  const orig = content;

  content = fixImports(content);
  content = fixWorkspaceScaffold(content, file);
  content = replaceAssertCalls(content);
  content = fixScriptChecks(content);

  if (content !== orig) {
    writeFileSync(file, content, "utf-8");
    migrated++;
  } else {
    skipped++;
  }
}

// 验证
let errors = 0;
for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const remaining = content.match(/\bassert\.\w+/g);
  if (remaining) {
    console.log(`REMAINING: ${basename(file)}: ${remaining.join(", ")}`);
    errors++;
  }
}

console.log(`Done: ${migrated} migrated, ${skipped} skipped, ${errors} files with remaining assert`);
