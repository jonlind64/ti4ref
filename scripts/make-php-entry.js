#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const html = resolve("dist/index.html");
const php = resolve("dist/index.php");

if (!existsSync(html)) {
  throw new Error("dist/index.html is missing; run Vite before creating the PHP entry point.");
}

// Vite emits a self-contained bundle, so it can safely run as a classic
// deferred script. Unlike ES modules, classic scripts are allowed when a user
// opens index.html directly through file://.
const portableHtml = readFileSync(html, "utf8")
  .replace('<script type="module" crossorigin ', "<script defer ")
  .replace('<link rel="stylesheet" crossorigin ', '<link rel="stylesheet" ');

writeFileSync(html, portableHtml);

// Valid PHP files may contain plain HTML without a PHP block. Keeping both
// entry points makes the artifact usable on PHP-only and ordinary static hosts.
writeFileSync(php, portableHtml);
console.log("Created portable dist/index.html and PHP 8.3 entry point");
