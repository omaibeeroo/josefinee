import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);

let entryPoint;
try {
  entryPoint = require.resolve("braces");
} catch {
  // braces is a development-only transitive dependency and can be omitted in
  // production-only installs. The full development install is covered by tests.
  console.log("[security-patch] braces is not installed; skipping development-only patch.");
  process.exit(0);
}

const packageRoot = dirname(entryPoint);
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
const versionParts = String(packageJson.version).split(".").map((part) => Number.parseInt(part, 10));
const [major, minor, patch] = versionParts;
const versionIsOutsideAffectedRange =
  Number.isInteger(major) &&
  Number.isInteger(minor) &&
  Number.isInteger(patch) &&
  (major > 3 || (major === 3 && (minor > 0 || patch >= 4)));

if (versionIsOutsideAffectedRange) {
  console.log(`[security-patch] braces ${packageJson.version} is outside the affected <=3.0.3 range.`);
  process.exit(0);
}

if (packageJson.version !== "3.0.3") {
  throw new Error(
    `[security-patch] Refusing to patch unexpected braces version ${packageJson.version}; review the package and update this patch explicitly.`,
  );
}

const parserPath = resolve(packageRoot, "lib/parse.js");
let parser = readFileSync(parserPath, "utf8");
const marker = "NUR_STORE_BRACES_DEPTH_GUARD";

if (parser.includes(marker)) {
  console.log("[security-patch] braces 3.0.3 depth guard is already applied.");
  process.exit(0);
}

const replacements = [
  [
    "const parse = (input, options = {}) => {",
    "const MAX_SAFE_NESTING_DEPTH = 100; // NUR_STORE_BRACES_DEPTH_GUARD\n\nconst parse = (input, options = {}) => {",
  ],
  [
    "if (value === CHAR_LEFT_PARENTHESES) {\n      block = push({ type: 'paren', nodes: [] });",
    "if (value === CHAR_LEFT_PARENTHESES) {\n      if (stack.length > MAX_SAFE_NESTING_DEPTH) {\n        throw new SyntaxError(`Input nesting depth (${stack.length}), exceeds max depth (${MAX_SAFE_NESTING_DEPTH})`);\n      }\n      block = push({ type: 'paren', nodes: [] });",
  ],
  [
    "if (value === CHAR_LEFT_CURLY_BRACE) {\n      depth++;",
    "if (value === CHAR_LEFT_CURLY_BRACE) {\n      if (stack.length > MAX_SAFE_NESTING_DEPTH) {\n        throw new SyntaxError(`Input nesting depth (${stack.length}), exceeds max depth (${MAX_SAFE_NESTING_DEPTH})`);\n      }\n      depth++;",
  ],
];

for (const [anchor, replacement] of replacements) {
  const occurrences = parser.split(anchor).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `[security-patch] Expected one parser anchor but found ${occurrences}; refusing to modify braces ${packageJson.version}.`,
    );
  }
  parser = parser.replace(anchor, replacement);
}

writeFileSync(parserPath, parser);
console.log("[security-patch] Applied braces 3.0.3 maximum nesting depth guard (100)." );
