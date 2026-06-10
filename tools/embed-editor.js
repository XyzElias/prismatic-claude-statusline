#!/usr/bin/env node
/**
 * Embeds config-editor.html into statusline.js as a base64 blob, so a single
 * download of statusline.js carries the visual editor with it (the script
 * writes config-editor.html into ~/.claude/ on first run).
 *
 * Run this whenever you change config-editor.html:
 *   node tools/embed-editor.js
 *
 * It rewrites the line:
 *   const EDITOR_B64 = "..."; /*<embed:config-editor.html>* /
 * in ../statusline.js. Zero dependencies.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EDITOR = path.join(ROOT, "config-editor.html");
const SCRIPT = path.join(ROOT, "statusline.js");

// Normalize line endings to LF so the embed is identical on every platform
// (Windows checkout vs. Linux CI runner) — keeps the CI embed-sync check stable.
const html = fs.readFileSync(EDITOR, "utf-8").replace(/\r\n/g, "\n");
const b64 = Buffer.from(html, "utf-8").toString("base64");

let js = fs.readFileSync(SCRIPT, "utf-8");
const marker = /const EDITOR_B64 = "[^"]*"; \/\*<embed:config-editor\.html>\*\//;
if (!marker.test(js)) {
  console.error("ERROR: embed marker not found in statusline.js");
  process.exit(1);
}
js = js.replace(marker, `const EDITOR_B64 = "${b64}"; /*<embed:config-editor.html>*/`);
fs.writeFileSync(SCRIPT, js, "utf-8");

console.log(`Embedded config-editor.html (${html.length} bytes → ${b64.length} base64 chars) into statusline.js`);
