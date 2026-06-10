#!/usr/bin/env node
/**
 * Claude Code Status Line
 * Truecolor gradient pills · rounded frame · zero dependencies
 *
 * Reads Claude Code's session JSON on stdin and prints a status line to stdout.
 * Config (auto-created on first run): ~/.claude/statusline_config.yml
 * Source & docs: https://github.com/XyzElias/prismatic-claude-statusline
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Mini YAML parser (subset — enough for this config) ─────
function parseYaml(text) {
  const lines = text.split("\n");
  const root = {};
  const stack = [{ indent: -1, obj: root, isList: false }];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = raw.replace(/#.*$/, "").trimEnd();
    if (!stripped.trim()) continue;

    const indent = raw.search(/\S/);
    const content = stripped.trim();

    // Pop stack to matching indent
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];

    // List item
    if (content.startsWith("- ")) {
      const itemStr = content.slice(2).trim();
      if (!Array.isArray(parent.obj)) {
        const prev = stack[stack.length - 1];
        if (!Array.isArray(prev.obj)) continue;
      }
      if (itemStr.includes(":")) {
        const itemObj = {};
        const { key, value } = parseKV(itemStr);
        itemObj[key] = value;
        // Peek ahead for more keys at deeper indent
        let j = i + 1;
        while (j < lines.length) {
          const nRaw = lines[j];
          const nStripped = nRaw.replace(/#.*$/, "").trimEnd();
          if (!nStripped.trim()) { j++; continue; }
          const nIndent = nRaw.search(/\S/);
          const nContent = nStripped.trim();
          if (nIndent <= indent || nContent.startsWith("- ")) break;
          if (nContent.includes(":")) {
            const kv = parseKV(nContent);
            itemObj[kv.key] = kv.value;
          }
          j++;
        }
        i = j - 1;
        parent.obj.push(itemObj);
      } else {
        parent.obj.push(parseValue(itemStr));
      }
      continue;
    }

    // Key: value
    if (content.includes(":")) {
      const { key, value } = parseKV(content);
      if (value === null) {
        // Peek: is the next line a list item or a nested map?
        let nextI = i + 1;
        while (nextI < lines.length && !lines[nextI].replace(/#.*$/, "").trim()) nextI++;
        if (nextI < lines.length) {
          const nextLine = lines[nextI].replace(/#.*$/, "").trim();
          if (nextLine.startsWith("- ")) {
            const arr = [];
            parent.obj[key] = arr;
            stack.push({ indent, obj: arr, isList: true });
          } else {
            const child = {};
            parent.obj[key] = child;
            stack.push({ indent, obj: child, isList: false });
          }
        } else {
          parent.obj[key] = "";
        }
      } else {
        parent.obj[key] = value;
      }
    }
  }
  return root;
}

function parseKV(str) {
  const idx = str.indexOf(":");
  const key = str.slice(0, idx).trim();
  const rest = str.slice(idx + 1).trim();
  if (!rest) return { key, value: null };
  return { key, value: parseValue(rest) };
}

function parseValue(s) {
  if (!s) return "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1);
  // Flow array: [1, 2, 3] or [[1,2],[3,4]]
  if (s.startsWith("[")) {
    try { return JSON.parse(s); } catch {}
    try { return JSON.parse(s.replace(/([a-zA-Z_]\w*)/g, '"$1"')); } catch {}
    return s;
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  const n = Number(s);
  if (!isNaN(n) && s !== "") return n;
  return s;
}

// ─── Config ─────────────────────────────────────────────────
const HOME = os.homedir();
const CFG_PATH = path.join(HOME, ".claude", "statusline_config.yml");
const DEFAULT_CFG = `# Claude Code Status Line — Configuration
#
# Pill style: nerd | unicode | ascii
#   nerd    — Powerline glyphs for rounded pill caps (requires a Nerd Font)
#   unicode — Unicode block characters (works in any modern terminal)
#   ascii   — Plain [brackets] (maximum compatibility)
# See docs/nerd-fonts.md if you want the rounded "nerd" caps.

style: unicode

show_labels: true

pills:
  model:
    enabled: true
    label: MODEL
    order: 1

  path:
    enabled: true
    label: PATH
    order: 2

  context:
    enabled: true
    label: CONTEXT
    order: 3
    bar_width: 10

  # Subscription usage (Claude Pro/Max). Auto-hides on API/pay-per-use plans,
  # which do not receive rate-limit data from Claude Code.
  rate:
    enabled: true
    label: USAGE
    order: 4
    bar_width: 10
    show_seven_day: false   # also show the 7-day window next to the 5-hour one

  diff:
    enabled: true
    label: DIFF
    order: 5

  # Estimated cost of the CURRENT session (client-side estimate from Claude Code).
  cost:
    enabled: true
    label: COST
    order: 6

  time:
    enabled: true
    label: TIME
    order: 7

colors:
  pill_bg: [58, 62, 72]
  frame: [120, 120, 138]
  label: [120, 120, 138]
  dim: [200, 185, 175]
  path: [120, 200, 255]
  time: [130, 210, 255]
  diff_add: [60, 255, 110]
  diff_sep: [70, 95, 90]
  diff_rm: [255, 75, 75]
  cost_grad: [[255, 220, 60], [255, 170, 30]]

  # Two-color gradient per model, matched by model id/name (case-insensitive).
  model_themes:
    opus: [[175, 100, 255], [255, 120, 230]]
    sonnet: [[40, 230, 160], [120, 255, 180]]
    haiku: [[255, 140, 60], [255, 90, 140]]
    fable: [[64, 224, 208], [255, 198, 88]]
    default: [[200, 200, 230], [240, 240, 255]]

  # Progress-bar / percentage colors by fill level (first match wins).
  thresholds:
    - below: 40
      color: [50, 255, 160]
    - below: 65
      color: [200, 255, 50]
    - below: 80
      color: [255, 210, 30]
    - below: 92
      color: [255, 120, 30]
    - below: 999
      color: [255, 50, 50]

frame:
  enabled: true
  top_left: "╭"
  top_right: "╮"
  bot_left: "╰"
  bot_right: "╯"
  horizontal: "─"
  vertical: "│"

# How many trailing directories of the working path to show.
path_segments: 2
`;

// Auto-create the default config on first run.
function ensureConfig() {
  if (!fs.existsSync(CFG_PATH)) {
    try { fs.writeFileSync(CFG_PATH, DEFAULT_CFG, "utf-8"); } catch {}
  }
}

ensureConfig();

let CFG = {};
try {
  CFG = parseYaml(fs.readFileSync(CFG_PATH, "utf-8"));
} catch {
  CFG = {};
}

function cfg(dotPath, defaultVal) {
  let node = CFG;
  for (const key of dotPath.split(".")) {
    if (node && typeof node === "object" && key in node) {
      node = node[key];
    } else {
      return defaultVal;
    }
  }
  return node != null ? node : defaultVal;
}

function col(dotPath, def) {
  const v = cfg(dotPath, def);
  return Array.isArray(v) ? v : def;
}

// ─── Read stdin (JSON from Claude Code) ─────────────────────
let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }
  render(data);
});

// ─── Style presets ──────────────────────────────────────────
const STYLE_PRESETS = {
  nerd:    { left: "", right: "" },
  unicode: { left: "▐", right: "▌" },
  ascii:   { left: "[",      right: "]" },
};

// ─── ANSI helpers ───────────────────────────────────────────
const RST = "\x1b[0m";
const BOLD = "\x1b[1m";
const ANSI_RE = /\x1b\[[^m]*m/g;

function fgC(r, g, b) { return `\x1b[38;2;${r};${g};${b}m`; }
function bgC(r, g, b) { return `\x1b[48;2;${r};${g};${b}m`; }
function stripAnsi(s) { return s.replace(ANSI_RE, ""); }
function visLen(s) { return stripAnsi(s).length; }

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function gradient(text, start, end) {
  if (!text) return "";
  const n = Math.max(text.length - 1, 1);
  return [...text].map((ch, i) =>
    fgC(lerp(start[0], end[0], i / n),
        lerp(start[1], end[1], i / n),
        lerp(start[2], end[2], i / n)) + ch
  ).join("");
}

// ─── Render ─────────────────────────────────────────────────
function render(data) {
  const BG_PILL = col("colors.pill_bg", [58, 62, 72]);
  const FRAME_COLOR = fgC(...col("colors.frame", [120, 120, 138]));
  const LABEL_COLOR = fgC(...col("colors.label", [120, 120, 138]));
  const DIM_COLOR = fgC(...col("colors.dim", [200, 185, 175]));

  const style = cfg("style", "unicode");
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.unicode;
  const PL_LEFT = preset.left;
  const PL_RIGHT = preset.right;

  const thresholds = cfg("colors.thresholds", [
    { below: 40, color: [50, 255, 160] },
    { below: 65, color: [200, 255, 50] },
    { below: 80, color: [255, 210, 30] },
    { below: 92, color: [255, 120, 30] },
    { below: 999, color: [255, 50, 50] },
  ]);

  function thresholdColor(val) {
    for (const t of thresholds) {
      if (val < t.below) return t.color;
    }
    return thresholds[thresholds.length - 1].color;
  }

  const modelThemes = cfg("colors.model_themes", {
    opus: [[175, 100, 255], [255, 120, 230]],
    sonnet: [[40, 230, 160], [120, 255, 180]],
    haiku: [[255, 140, 60], [255, 90, 140]],
    fable: [[64, 224, 208], [255, 198, 88]],
    default: [[200, 200, 230], [240, 240, 255]],
  });

  // ── Data extraction ──────────────────────────────────────
  const modelObj = data.model || {};
  const modelName = modelObj.display_name || "?";
  const modelId = modelObj.id || "";

  const cwd = (data.workspace || {}).current_dir || data.cwd || "";
  const parts = cwd.replace(/\\/g, "/").replace(/\/$/, "").split("/");
  const nSeg = cfg("path_segments", 2);
  const pathStr = parts.length > nSeg
    ? "…/" + parts.slice(-nSeg).join("/")
    : parts.join("/");

  const ctx = data.context_window || {};
  const pct = Math.min(Math.round(ctx.used_percentage || 0), 100);
  const ctxSize = ctx.context_window_size || 0;
  const ctxFmt = ctxSize >= 1e6
    ? (ctxSize / 1e6).toFixed(1) + "M"
    : ctxSize >= 1000 ? Math.floor(ctxSize / 1000) + "k" : String(ctxSize);

  const costData = data.cost || {};
  const costUsd = costData.total_cost_usd || 0;
  const linesAdd = costData.total_lines_added || 0;
  const linesRm = costData.total_lines_removed || 0;

  const durTotal = Math.floor((costData.total_duration_ms || 0) / 1000);
  const durH = Math.floor(durTotal / 3600);
  const durM = Math.floor((durTotal % 3600) / 60);
  const durS = durTotal % 60;
  const duration = durH
    ? `${durH}h ${String(durM).padStart(2, "0")}m`
    : `${durM}m ${String(durS).padStart(2, "0")}s`;

  // ── Rate limits (Claude Pro/Max only; absent on API plans) ──
  function rateWindow(win) {
    if (!win) return null;
    const wPct = Math.round(win.used_percentage || 0);
    let resetStr = "";
    try {
      if (win.resets_at > 0) {
        const d = new Date(win.resets_at * 1000);
        resetStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    } catch {}
    return { pct: wPct, resetStr };
  }
  const rl = data.rate_limits || {};
  const w5 = rateWindow(rl.five_hour);
  const w7 = rateWindow(rl.seven_day);

  // ── Model theme (matched by id/name substring) ───────────
  const modelKey = (modelId || modelName).toLowerCase();
  let themeGrad = null;
  for (const [k, grad] of Object.entries(modelThemes)) {
    if (k !== "default" && modelKey.includes(k)) {
      themeGrad = [grad[0], grad[1]];
      break;
    }
  }
  if (!themeGrad) {
    const d = modelThemes.default || [[200, 200, 230], [240, 240, 255]];
    themeGrad = [d[0], d[1]];
  }

  // ── Progress bar ─────────────────────────────────────────
  function progressBar(pctVal, width, color) {
    const filled = Math.min(Math.floor(pctVal * width / 100), width);
    const track = BG_PILL.map(v => Math.min(255, v + 55));
    let out = "";
    for (let i = 0; i < width; i++) {
      const t = i / Math.max(width - 1, 1);
      const factors = [0.2, 0.12, 0.08];
      if (i < filled) {
        const cc = color.map((v, j) => Math.min(255, Math.round(v * (1 - t * factors[j]))));
        out += fgC(...cc) + "━";
      } else {
        out += fgC(...track) + "━";
      }
    }
    return out;
  }

  // ── Pill builder ─────────────────────────────────────────
  let pills = "";
  let labels = "";
  let first = true;

  function addPill(content, label) {
    const gap = first ? "" : " ";
    first = false;
    const b = BG_PILL;
    const pillStr = fgC(...b) + PL_LEFT + bgC(...b) + " "
      + content + RST + bgC(...b) + " " + RST + fgC(...b) + PL_RIGHT;
    pills += gap + pillStr;
    const pillW = visLen(pillStr);
    const centered = label ? label.padStart(Math.floor((pillW + label.length) / 2)).padEnd(pillW) : " ".repeat(pillW);
    labels += gap + LABEL_COLOR + centered + RST;
  }

  function pillCfg(name) {
    const p = cfg(`pills.${name}`, { enabled: true, label: name.toUpperCase() });
    return (p && p.enabled !== false) ? p : null;
  }

  // ── Build segments ───────────────────────────────────────
  const segments = [];

  { // Model
    const p = pillCfg("model");
    if (p) segments.push({ order: p.order || 1, build: () => {
      addPill(BOLD + gradient(modelName, themeGrad[0], themeGrad[1]) + RST + bgC(...BG_PILL), p.label || "MODEL");
    }});
  }

  { // Path
    const p = pillCfg("path");
    if (p) segments.push({ order: p.order || 2, build: () => {
      addPill(BOLD + fgC(...col("colors.path", [120, 200, 255])) + pathStr + RST + bgC(...BG_PILL), p.label || "PATH");
    }});
  }

  { // Context window
    const p = pillCfg("context");
    if (p) {
      const bw = p.bar_width || 10;
      const ctxClr = thresholdColor(pct);
      segments.push({ order: p.order || 3, build: () => {
        addPill(
          fgC(...ctxClr) + BOLD + `${pct}%` + RST + bgC(...BG_PILL)
          + DIM_COLOR + ` / ${ctxFmt}  `
          + progressBar(pct, bw, ctxClr) + RST + bgC(...BG_PILL),
          p.label || "CONTEXT"
        );
      }});
    }
  }

  { // Subscription usage (rate limits) — only when Claude Code provides them
    const p = pillCfg("rate");
    const showSeven = p && p.show_seven_day === true;
    if (p && (w5 || (showSeven && w7))) {
      const bw = p.bar_width || 10;
      segments.push({ order: p.order || 4, build: () => {
        let content = "";
        if (w5) {
          const c = thresholdColor(w5.pct);
          content += fgC(...c) + BOLD + `${w5.pct}%` + RST + bgC(...BG_PILL)
            + "  " + progressBar(w5.pct, bw, c) + RST + bgC(...BG_PILL)
            + (w5.resetStr ? DIM_COLOR + `  ${w5.resetStr}` : "");
        }
        if (showSeven && w7) {
          const c = thresholdColor(w7.pct);
          content += (w5 ? DIM_COLOR + "  ·  " : "")
            + fgC(...c) + BOLD + `7d ${w7.pct}%` + RST + bgC(...BG_PILL);
        }
        addPill(content, p.label || "USAGE");
      }});
    }
  }

  { // Diff
    const p = pillCfg("diff");
    if (p && (linesAdd > 0 || linesRm > 0)) {
      segments.push({ order: p.order || 5, build: () => {
        addPill(
          fgC(...col("colors.diff_add", [60, 255, 110])) + BOLD + `+${linesAdd}` + RST + bgC(...BG_PILL)
          + fgC(...col("colors.diff_sep", [70, 95, 90])) + "  "
          + fgC(...col("colors.diff_rm", [255, 75, 75])) + BOLD + `−${linesRm}` + RST + bgC(...BG_PILL),
          p.label || "DIFF"
        );
      }});
    }
  }

  { // Session cost
    const p = pillCfg("cost");
    if (p) {
      const cg = cfg("colors.cost_grad", [[255, 220, 60], [255, 170, 30]]);
      segments.push({ order: p.order || 6, build: () => {
        addPill(
          BOLD + gradient(`$${costUsd.toFixed(2)}`, cg[0], cg[1]) + RST + bgC(...BG_PILL),
          p.label || "COST"
        );
      }});
    }
  }

  { // Session duration
    const p = pillCfg("time");
    if (p) segments.push({ order: p.order || 7, build: () => {
      addPill(BOLD + fgC(...col("colors.time", [130, 210, 255])) + duration + RST + bgC(...BG_PILL), p.label || "TIME");
    }});
  }

  // ── Render (sorted by order) ─────────────────────────────
  segments.sort((a, b) => a.order - b.order);
  for (const seg of segments) seg.build();

  // ── Frame & output ───────────────────────────────────────
  const showLabels = cfg("show_labels", true);
  const w = visLen(pills);

  const fr = cfg("frame", {});
  if (fr.enabled !== false) {
    const h = fr.horizontal || "─";
    const v = fr.vertical || "│";
    const top = FRAME_COLOR + (fr.top_left || "╭") + h.repeat(w + 2) + (fr.top_right || "╮") + RST;
    const bot = FRAME_COLOR + (fr.bot_left || "╰") + h.repeat(w + 2) + (fr.bot_right || "╯") + RST;
    const row = FRAME_COLOR + v + RST + " " + pills + " " + FRAME_COLOR + v + RST;
    process.stdout.write("​\n");
    process.stdout.write(top + "\n");
    process.stdout.write(row + "\n");
    if (showLabels) {
      process.stdout.write(FRAME_COLOR + v + RST + " " + labels + " " + FRAME_COLOR + v + RST + "\n");
    }
    process.stdout.write(bot + "\n");
    process.stdout.write("​\n");
  } else {
    process.stdout.write("​\n");
    process.stdout.write(pills + "\n");
    if (showLabels) {
      process.stdout.write(labels + "\n");
    }
    process.stdout.write("​\n");
  }
}

// ─── Embedded visual config editor ──────────────────────────
// On first run, drop config-editor.html into ~/.claude/ so the visual
// editor is available without any separate download. The base64 blob below
// is generated from config-editor.html by `node tools/embed-editor.js`;
// do not edit it by hand.
const EDITOR_B64 = "PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9IlVURi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAiPgo8dGl0bGU+UHJpc21hdGljIOKAlCBDbGF1ZGUgQ29kZSBTdGF0dXMgTGluZSBDb25maWc8L3RpdGxlPgo8c3R5bGU+Cip7bWFyZ2luOjA7cGFkZGluZzowO2JveC1zaXppbmc6Ym9yZGVyLWJveH0KOnJvb3R7CiAgLS1iZzojMGIwYjBmOy0tY2FyZDojMTYxNjIwOy0taW5wdXQ6IzFjMWMyNjstLWJvcmRlcjojMmMyYzNhOwogIC0tdGV4dDojZDhkOGUwOy0tZGltOiM4YThhOTk7LS1hY2NlbnQ6IzliOGNmZjstLW9uOiM1YWQ2YTA7CiAgLS1vZmY6IzNmM2Y0YzstLXJhZGl1czo5cHg7CiAgLyogcHJpc21hdGljIGJyYW5kIGdyYWRpZW50ICh0dXJxdW9pc2Ug4oaSIHZpb2xldCDihpIgbWFnZW50YSDihpIgZ29sZCkgKi8KICAtLXByaXNtOmxpbmVhci1ncmFkaWVudCgxMDBkZWcsIzQwZTBkMCwjOWI4Y2ZmIDQwJSwjZmY3YmU2IDcwJSwjZmZjNjU4KTsKfQpib2R5ewogIGZvbnQtZmFtaWx5Oi1hcHBsZS1zeXN0ZW0sc3lzdGVtLXVpLCdTZWdvZSBVSScsc2Fucy1zZXJpZjsKICBjb2xvcjp2YXIoLS10ZXh0KTtmb250LXNpemU6MTRweDtsaW5lLWhlaWdodDoxLjU7CiAgYmFja2dyb3VuZDoKICAgIHJhZGlhbC1ncmFkaWVudCg5MDBweCA1MDBweCBhdCAxMiUgLTglLCByZ2JhKDY0LDIyNCwyMDgsLjEwKSwgdHJhbnNwYXJlbnQgNjAlKSwKICAgIHJhZGlhbC1ncmFkaWVudCgxMDAwcHggNjAwcHggYXQgMTAwJSAwJSwgcmdiYSgyNTUsMTIzLDIzMCwuMTApLCB0cmFuc3BhcmVudCA1NSUpLAogICAgdmFyKC0tYmcpOwogIG1pbi1oZWlnaHQ6MTAwdmg7Cn0KCi8qIOKUgOKUgCBTdGlja3kgcHJldmlldyB0b3AgYmFyIOKUgOKUgCAqLwoucHJldmlldy1iYXJ7CiAgcG9zaXRpb246c3RpY2t5O3RvcDowO3otaW5kZXg6NTA7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCMwYzBjMTIsIzA4MDgwYyk7CiAgYm9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTsKICBwYWRkaW5nOjE2cHggMjRweDsKICBib3gtc2hhZG93OjAgOHB4IDI0cHggLTEycHggcmdiYSgwLDAsMCwuOCk7Cn0KLnByZXZpZXctYmFyOjphZnRlcnsKICBjb250ZW50OiIiO3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6MDtyaWdodDowO2JvdHRvbTotMXB4O2hlaWdodDoxcHg7CiAgYmFja2dyb3VuZDp2YXIoLS1wcmlzbSk7b3BhY2l0eTouNjsKfQoucHJldmlldy1oZWFkZXJ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjhweDtmbGV4LXdyYXA6d3JhcDtnYXA6OHB4fQoucHJldmlldy1sYWJlbHtmb250LXNpemU6MTBweDtjb2xvcjp2YXIoLS1kaW0pO2xldHRlci1zcGFjaW5nOi41cHg7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlfQoucHJldmlldy1jb250cm9sc3tkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMHB4O2ZsZXgtd3JhcDp3cmFwfQoucHJldmlldy1jb250cm9scyBzZWxlY3R7CiAgYmFja2dyb3VuZDp2YXIoLS1pbnB1dCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2JvcmRlci1yYWRpdXM6M3B4OwogIGNvbG9yOnZhcigtLXRleHQpO3BhZGRpbmc6M3B4IDIwcHggM3B4IDZweDtmb250LXNpemU6MTFweDtmb250LWZhbWlseTppbmhlcml0OwogIG91dGxpbmU6bm9uZTtjdXJzb3I6cG9pbnRlcjstd2Via2l0LWFwcGVhcmFuY2U6bm9uZTthcHBlYXJhbmNlOm5vbmU7CiAgYmFja2dyb3VuZC1pbWFnZTp1cmwoImRhdGE6aW1hZ2Uvc3ZnK3htbCwlM0Nzdmcgd2lkdGg9JzEwJyBoZWlnaHQ9JzYnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyclM0UlM0NwYXRoIGQ9J00wIDBsNSA2IDUtNnonIGZpbGw9JyUyMzY2NicvJTNFJTNDL3N2ZyUzRSIpOwogIGJhY2tncm91bmQtcmVwZWF0Om5vLXJlcGVhdDtiYWNrZ3JvdW5kLXBvc2l0aW9uOnJpZ2h0IDVweCBjZW50ZXI7Cn0KLnB2LXNsaWRlci1sYWJlbHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo2cHg7Zm9udC1zaXplOjExcHg7Y29sb3I6dmFyKC0tZGltKX0KLnB2LXNsaWRlci1sYWJlbCBpbnB1dFt0eXBlPXJhbmdlXXsKICB3aWR0aDo4MHB4O2hlaWdodDo0cHg7LXdlYmtpdC1hcHBlYXJhbmNlOm5vbmU7YXBwZWFyYW5jZTpub25lOwogIGJhY2tncm91bmQ6dmFyKC0tYm9yZGVyKTtib3JkZXItcmFkaXVzOjJweDtvdXRsaW5lOm5vbmU7Y3Vyc29yOnBvaW50ZXI7Cn0KLnB2LXNsaWRlci1sYWJlbCBpbnB1dFt0eXBlPXJhbmdlXTo6LXdlYmtpdC1zbGlkZXItdGh1bWJ7CiAgLXdlYmtpdC1hcHBlYXJhbmNlOm5vbmU7d2lkdGg6MTNweDtoZWlnaHQ6MTNweDtib3JkZXItcmFkaXVzOjUwJTsKICBiYWNrZ3JvdW5kOiNmZmY7Y3Vyc29yOnBvaW50ZXI7Ym94LXNoYWRvdzowIDAgMCAzcHggcmdiYSgxNTUsMTQwLDI1NSwuNSk7Cn0KI3B2LXVzYWdlLXZhbHttaW4td2lkdGg6MzBweDt0ZXh0LWFsaWduOnJpZ2h0O2NvbG9yOnZhcigtLXRleHQpO2ZvbnQtc2l6ZToxMXB4fQojcHJldmlld3sKICBmb250LWZhbWlseTonQ2Fza2F5ZGlhQ292ZSBOZXJkIEZvbnQnLCdGaXJhQ29kZSBOZXJkIEZvbnQnLCdKZXRCcmFpbnNNb25vIE5lcmQgRm9udCcsJ0Nhc2NhZGlhIENvZGUnLCdGaXJhIENvZGUnLCdDb25zb2xhcycsbW9ub3NwYWNlOwogIGZvbnQtc2l6ZToxM3B4O2xpbmUtaGVpZ2h0OjEuNzt3aGl0ZS1zcGFjZTpwcmU7dGV4dC1hbGlnbjpjZW50ZXI7CiAgcGFkZGluZzoxNnB4IDEycHg7Ym9yZGVyLXJhZGl1czoxMHB4OwogIGJhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KDEyMCUgMTQwJSBhdCA1MCUgMCUsICMxNTE1MWYsICMwYTBhMGUpOwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tYm9yZGVyKTtvdmVyZmxvdy14OmF1dG87Cn0KCi8qIOKUgOKUgCBNYWluIGNvbnRlbnQg4pSA4pSAICovCi5tYWlue3BhZGRpbmc6MzJweDttYXgtd2lkdGg6MTEwMHB4O21hcmdpbjowIGF1dG99Ci5icmFuZHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6YmFzZWxpbmU7Z2FwOjEwcHg7bWFyZ2luLWJvdHRvbTo0cHg7ZmxleC13cmFwOndyYXB9CmgxewogIGZvbnQtc2l6ZTozMHB4O2ZvbnQtd2VpZ2h0OjgwMDtsZXR0ZXItc3BhY2luZzotLjVweDtsaW5lLWhlaWdodDoxOwogIGJhY2tncm91bmQ6dmFyKC0tcHJpc20pOy13ZWJraXQtYmFja2dyb3VuZC1jbGlwOnRleHQ7YmFja2dyb3VuZC1jbGlwOnRleHQ7CiAgLXdlYmtpdC10ZXh0LWZpbGwtY29sb3I6dHJhbnNwYXJlbnQ7Y29sb3I6dHJhbnNwYXJlbnQ7Cn0KLmJyYW5kIC5oMS1zdWJ7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NjAwO2NvbG9yOnZhcigtLWRpbSk7bGV0dGVyLXNwYWNpbmc6LjNweH0KLnN1Yntjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZToxM3B4O21hcmdpbi1ib3R0b206MjRweDttYXgtd2lkdGg6NjQwcHh9Ci5zdWIgY29kZXtiYWNrZ3JvdW5kOnZhcigtLWlucHV0KTtwYWRkaW5nOjFweCA2cHg7Ym9yZGVyLXJhZGl1czo0cHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tdGV4dCl9CgovKiDilIDilIAgVHdvLWNvbHVtbiBncmlkIGZvciBjYXJkcyDilIDilIAgKi8KLmdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDoxMnB4fQouZ3JpZCAuZnVsbHtncmlkLWNvbHVtbjoxLy0xfQpAbWVkaWEobWF4LXdpZHRoOjgwMHB4KXsuZ3JpZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfX0KCi8qIOKUgOKUgCBDYXJkIOKUgOKUgCAqLwouY2FyZHsKICBwb3NpdGlvbjpyZWxhdGl2ZTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxODBkZWcsIzE4MTgyNCwjMTQxNDIwKTsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czp2YXIoLS1yYWRpdXMpO3BhZGRpbmc6MTZweCAxOHB4OwogIHRyYW5zaXRpb246Ym9yZGVyLWNvbG9yIC4xOHMsIHRyYW5zZm9ybSAuMThzLCBib3gtc2hhZG93IC4xOHM7Cn0KLmNhcmQ6aG92ZXJ7Ym9yZGVyLWNvbG9yOiMzYTNhNGQ7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTFweCk7Ym94LXNoYWRvdzowIDEwcHggMjhweCAtMThweCByZ2JhKDAsMCwwLC45KX0KLmNhcmQtdGl0bGV7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNiOWI5Y2M7bGV0dGVyLXNwYWNpbmc6LjZweDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bWFyZ2luLWJvdHRvbToxMnB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjZweH0KLmNhcmQtdGl0bGU6OmJlZm9yZXtjb250ZW50OiIiO3dpZHRoOjEwcHg7aGVpZ2h0OjEwcHg7Ym9yZGVyLXJhZGl1czozcHg7YmFja2dyb3VuZDp2YXIoLS1wcmlzbSk7ZmxleC1zaHJpbms6MH0KCi8qIOKUgOKUgCBJbnB1dHMg4pSA4pSAICovCmlucHV0W3R5cGU9bnVtYmVyXSxpbnB1dFt0eXBlPXRleHRdLHNlbGVjdHsKICBiYWNrZ3JvdW5kOnZhcigtLWlucHV0KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czo0cHg7CiAgY29sb3I6dmFyKC0tdGV4dCk7cGFkZGluZzo1cHggOHB4O2ZvbnQtc2l6ZToxM3B4O2ZvbnQtZmFtaWx5OmluaGVyaXQ7CiAgb3V0bGluZTpub25lO3RyYW5zaXRpb246Ym9yZGVyLWNvbG9yIC4xNXMsIGJveC1zaGFkb3cgLjE1czsKfQppbnB1dFt0eXBlPW51bWJlcl06Zm9jdXMsaW5wdXRbdHlwZT10ZXh0XTpmb2N1cyxzZWxlY3Q6Zm9jdXN7Ym9yZGVyLWNvbG9yOnZhcigtLWFjY2VudCk7Ym94LXNoYWRvdzowIDAgMCAzcHggcmdiYSgxNTUsMTQwLDI1NSwuMTgpfQppbnB1dFt0eXBlPW51bWJlcl17d2lkdGg6NzJweH0KaW5wdXRbdHlwZT10ZXh0XXt3aWR0aDoxMzBweH0Kc2VsZWN0ewogIGN1cnNvcjpwb2ludGVyO3BhZGRpbmctcmlnaHQ6MjJweDstd2Via2l0LWFwcGVhcmFuY2U6bm9uZTthcHBlYXJhbmNlOm5vbmU7CiAgYmFja2dyb3VuZC1pbWFnZTp1cmwoImRhdGE6aW1hZ2Uvc3ZnK3htbCwlM0Nzdmcgd2lkdGg9JzEwJyBoZWlnaHQ9JzYnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyclM0UlM0NwYXRoIGQ9J00wIDBsNSA2IDUtNnonIGZpbGw9JyUyMzY2NicvJTNFJTNDL3N2ZyUzRSIpOwogIGJhY2tncm91bmQtcmVwZWF0Om5vLXJlcGVhdDtiYWNrZ3JvdW5kLXBvc2l0aW9uOnJpZ2h0IDdweCBjZW50ZXI7Cn0KaW5wdXRbdHlwZT1jb2xvcl17CiAgd2lkdGg6MjhweDtoZWlnaHQ6MjRweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czozcHg7CiAgY3Vyc29yOnBvaW50ZXI7YmFja2dyb3VuZDpub25lO3BhZGRpbmc6MnB4Owp9CmlucHV0W3R5cGU9Y29sb3JdOjotd2Via2l0LWNvbG9yLXN3YXRjaC13cmFwcGVye3BhZGRpbmc6MH0KaW5wdXRbdHlwZT1jb2xvcl06Oi13ZWJraXQtY29sb3Itc3dhdGNoe2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6MnB4fQoKLyog4pSA4pSAIEZpZWxkIOKUgOKUgCAqLwouZmllbGR7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTBweDttYXJnaW4tYm90dG9tOjhweH0KLmZpZWxkLWxhYmVse21pbi13aWR0aDoxMDBweDtmb250LXNpemU6MTNweDtjb2xvcjp2YXIoLS1kaW0pO2ZsZXgtc2hyaW5rOjA7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NHB4fQouZmllbGQtcGFpcntkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnI7Z2FwOjhweH0KQG1lZGlhKG1heC13aWR0aDo1MDBweCl7LmZpZWxkLXBhaXJ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn19Ci5maWVsZC1jb2xvcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo2cHh9CgovKiDilIDilIAgSW5mbyB0b29sdGlwIOKUgOKUgCAqLwouaW5mb3sKICBkaXNwbGF5OmlubGluZS1mbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOwogIHdpZHRoOjE0cHg7aGVpZ2h0OjE0cHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDp2YXIoLS1ib3JkZXIpOwogIGNvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjlweDtmb250LXdlaWdodDo3MDA7Y3Vyc29yOmhlbHA7CiAgcG9zaXRpb246cmVsYXRpdmU7ZmxleC1zaHJpbms6MDtmb250LXN0eWxlOml0YWxpYztmb250LWZhbWlseTpzZXJpZjsKfQouaW5mbzpob3Zlcjo6YWZ0ZXJ7CiAgY29udGVudDphdHRyKGRhdGEtdGlwKTtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OmNhbGMoMTAwJSArIDhweCk7dG9wOjUwJTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtNTAlKTsKICBiYWNrZ3JvdW5kOiMyMjI7Y29sb3I6dmFyKC0tdGV4dCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpOwogIHBhZGRpbmc6NnB4IDEwcHg7Ym9yZGVyLXJhZGl1czo0cHg7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NDAwO2ZvbnQtc3R5bGU6bm9ybWFsO2ZvbnQtZmFtaWx5Oi1hcHBsZS1zeXN0ZW0sc3lzdGVtLXVpLHNhbnMtc2VyaWY7CiAgd2hpdGUtc3BhY2U6bm9ybWFsO3otaW5kZXg6MTAwO3BvaW50ZXItZXZlbnRzOm5vbmU7d2lkdGg6MjQwcHg7bGluZS1oZWlnaHQ6MS41O3RleHQtdHJhbnNmb3JtOm5vbmU7bGV0dGVyLXNwYWNpbmc6bm9ybWFsOwp9CgovKiDilIDilIAgVG9nZ2xlIOKUgOKUgCAqLwoudG9nZ2xle3Bvc2l0aW9uOnJlbGF0aXZlO2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjM0cHg7aGVpZ2h0OjE4cHg7ZmxleC1zaHJpbms6MH0KLnRvZ2dsZSBpbnB1dHtwb3NpdGlvbjphYnNvbHV0ZTtvcGFjaXR5OjA7d2lkdGg6MDtoZWlnaHQ6MH0KLnRvZ2dsZSBzcGFuewogIHBvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7YmFja2dyb3VuZDp2YXIoLS1vZmYpO2JvcmRlci1yYWRpdXM6OXB4OwogIGN1cnNvcjpwb2ludGVyO3RyYW5zaXRpb246LjJzOwp9Ci50b2dnbGUgc3Bhbjo6YWZ0ZXJ7CiAgY29udGVudDonJztwb3NpdGlvbjphYnNvbHV0ZTt3aWR0aDoxNHB4O2hlaWdodDoxNHB4O2JvcmRlci1yYWRpdXM6NTAlOwogIGJhY2tncm91bmQ6Izg4ODt0b3A6MnB4O2xlZnQ6MnB4O3RyYW5zaXRpb246LjJzOwp9Ci50b2dnbGUgaW5wdXQ6Y2hlY2tlZCtzcGFue2JhY2tncm91bmQ6dmFyKC0tb24pfQoudG9nZ2xlIGlucHV0OmNoZWNrZWQrc3Bhbjo6YWZ0ZXJ7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoMTZweCk7YmFja2dyb3VuZDojZmZmfQoKLyog4pSA4pSAIFBpbGwgbGlzdCDilIDilIAgKi8KLnBpbGwtaXRlbXsKICBkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7cGFkZGluZzo2cHggMTBweDsKICBiYWNrZ3JvdW5kOnZhcigtLWlucHV0KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czo0cHg7CiAgbWFyZ2luLWJvdHRvbTo0cHg7Y3Vyc29yOmdyYWI7dXNlci1zZWxlY3Q6bm9uZTsKfQoucGlsbC1pdGVtOmFjdGl2ZXtjdXJzb3I6Z3JhYmJpbmd9Ci5waWxsLWl0ZW0gLmhhbmRsZXtjb2xvcjp2YXIoLS1kaW0pO2ZvbnQtc2l6ZToxM3B4O2N1cnNvcjpncmFiO2xpbmUtaGVpZ2h0OjF9Ci5waWxsLWl0ZW0gLm5hbWV7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NTAwO21pbi13aWR0aDo1NnB4O2NvbG9yOnZhcigtLXRleHQpfQoucGlsbC1pdGVtIGlucHV0W3R5cGU9dGV4dF17d2lkdGg6MTAwcHg7Zm9udC1zaXplOjEycHg7cGFkZGluZzozcHggNnB4fQoucGlsbC1pdGVtIGlucHV0W3R5cGU9bnVtYmVyXXt3aWR0aDo0NnB4O2ZvbnQtc2l6ZToxMnB4O3BhZGRpbmc6M3B4IDZweH0KLnBpbGwtaXRlbS5kcmFnZ2luZ3tvcGFjaXR5Oi4zfQoucGlsbC1pdGVtIC5iYXItbGFiZWx7Zm9udC1zaXplOjEwcHg7Y29sb3I6dmFyKC0tZGltKX0KCi8qIOKUgOKUgCBUaHJlc2hvbGQg4pSA4pSAICovCi50aHJ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NnB4O21hcmdpbi1ib3R0b206NXB4fQoudGhyIGlucHV0W3R5cGU9bnVtYmVyXXt3aWR0aDo1NnB4fQoudGhyLWxhYmVse2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLWRpbSk7bWluLXdpZHRoOjMycHh9CgovKiDilIDilIAgR3JhZGllbnQg4pSA4pSAICovCi5ncmFke2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjZweDttYXJnaW4tYm90dG9tOjZweH0KLmdyYWQgLmxhYmVse21pbi13aWR0aDo2NHB4O2ZvbnQtc2l6ZToxMnB4O2NvbG9yOnZhcigtLWRpbSk7dGV4dC10cmFuc2Zvcm06Y2FwaXRhbGl6ZX0KLmdyYWQgLmFycm93e2NvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjExcHh9CgovKiDilIDilIAgSW5zdGFsbCBpbnN0cnVjdGlvbnMg4pSA4pSAICovCi5pbnN0cnVjdGlvbnN7CiAgYmFja2dyb3VuZDp2YXIoLS1jYXJkKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czp2YXIoLS1yYWRpdXMpOwogIHBhZGRpbmc6MTZweCAxOHB4O21hcmdpbi1ib3R0b206MTJweDtmb250LXNpemU6MTJweDtsaW5lLWhlaWdodDoxLjg7Cn0KLmluc3RydWN0aW9ucyBie2NvbG9yOnZhcigtLXRleHQpO2ZvbnQtc2l6ZToxM3B4fQouaW5zdHJ1Y3Rpb25zIGNvZGV7YmFja2dyb3VuZDp2YXIoLS1pbnB1dCk7cGFkZGluZzoxcHggNXB4O2JvcmRlci1yYWRpdXM6M3B4O2ZvbnQtc2l6ZToxMXB4fQouaW5zdHJ1Y3Rpb25zIG9se3BhZGRpbmctbGVmdDoxOHB4O21hcmdpbjo4cHggMCAwfQouaW5zdHJ1Y3Rpb25zIGxpe21hcmdpbi1ib3R0b206MnB4O2NvbG9yOnZhcigtLWRpbSl9CgovKiDilIDilIAgQnV0dG9ucyDilIDilIAgKi8KLmFjdGlvbnN7ZGlzcGxheTpmbGV4O2dhcDo4cHg7ZmxleC13cmFwOndyYXB9Ci5idG57CiAgcGFkZGluZzo4cHggMThweDtib3JkZXItcmFkaXVzOjdweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7CiAgZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjAwO2ZvbnQtZmFtaWx5OmluaGVyaXQ7Y3Vyc29yOnBvaW50ZXI7dHJhbnNpdGlvbjouMTVzOwogIGJhY2tncm91bmQ6dmFyKC0taW5wdXQpO2NvbG9yOnZhcigtLXRleHQpOwp9Ci5idG46aG92ZXJ7Ym9yZGVyLWNvbG9yOnZhcigtLWFjY2VudCk7Y29sb3I6I2ZmZn0KLmJ0bi1wcmltYXJ5e2JhY2tncm91bmQ6dmFyKC0tcHJpc20pO2NvbG9yOiMxMTExMWE7Ym9yZGVyOm5vbmU7Zm9udC13ZWlnaHQ6NzAwfQouYnRuLXByaW1hcnk6aG92ZXJ7ZmlsdGVyOmJyaWdodG5lc3MoMS4wOCkgc2F0dXJhdGUoMS4xKX0KCi8qIOKUgOKUgCBUb2FzdCDilIDilIAgKi8KLnRvYXN0ewogIHBvc2l0aW9uOmZpeGVkO2JvdHRvbToyMHB4O2xlZnQ6NTAlO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpIHRyYW5zbGF0ZVkoNTBweCk7CiAgYmFja2dyb3VuZDojMjIyO2NvbG9yOiNlZWU7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpOwogIHBhZGRpbmc6N3B4IDE4cHg7Ym9yZGVyLXJhZGl1czo0cHg7Zm9udC1zaXplOjEycHg7b3BhY2l0eTowO3RyYW5zaXRpb246LjI1czt6LWluZGV4Ojk5Owp9Ci50b2FzdC5zaG93e3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpIHRyYW5zbGF0ZVkoMCk7b3BhY2l0eToxfQoKLyog4pSA4pSAIE1vZGFsIOKUgOKUgCAqLwoub3ZlcmxheXtwb3NpdGlvbjpmaXhlZDtpbnNldDowO2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuNSk7ZGlzcGxheTpub25lO2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO3otaW5kZXg6OTB9Ci5vdmVybGF5LnNob3d7ZGlzcGxheTpmbGV4fQoubW9kYWx7CiAgYmFja2dyb3VuZDp2YXIoLS1jYXJkKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czp2YXIoLS1yYWRpdXMpOwogIHBhZGRpbmc6MjBweDttYXgtd2lkdGg6NjQwcHg7d2lkdGg6OTAlO21heC1oZWlnaHQ6ODB2aDtvdmVyZmxvdy15OmF1dG87Cn0KLm1vZGFsIGgze2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjEycHh9Ci5tb2RhbCBwcmV7CiAgYmFja2dyb3VuZDojMGEwYTBhO2NvbG9yOnZhcigtLXRleHQpO3BhZGRpbmc6MTRweDtib3JkZXItcmFkaXVzOjRweDsKICBmb250LXNpemU6MTFweDtsaW5lLWhlaWdodDoxLjY7b3ZlcmZsb3cteDphdXRvO3doaXRlLXNwYWNlOnByZS13cmFwO21hcmdpbi1ib3R0b206MTJweDsKfQoubW9kYWwgLmFjdGlvbnN7anVzdGlmeS1jb250ZW50OmZsZXgtZW5kfQo8L3N0eWxlPgo8L2hlYWQ+Cjxib2R5PgoKPCEtLSBTdGlja3kgUHJldmlldyAtLT4KPGRpdiBjbGFzcz0icHJldmlldy1iYXIiPgogIDxkaXYgY2xhc3M9InByZXZpZXctaGVhZGVyIj4KICAgIDxzcGFuIGNsYXNzPSJwcmV2aWV3LWxhYmVsIj5MaXZlIFByZXZpZXc8L3NwYW4+CiAgICA8ZGl2IGNsYXNzPSJwcmV2aWV3LWNvbnRyb2xzIj4KICAgICAgPHNlbGVjdCBpZD0icHYtbW9kZWwiIG9uY2hhbmdlPSJyZW5kZXJQcmV2aWV3KCkiIHRpdGxlPSJQcmV2aWV3IG1vZGVsIj4KICAgICAgICA8b3B0aW9uIHZhbHVlPSJvcHVzIiBzZWxlY3RlZD5PcHVzPC9vcHRpb24+CiAgICAgICAgPG9wdGlvbiB2YWx1ZT0ic29ubmV0Ij5Tb25uZXQ8L29wdGlvbj4KICAgICAgICA8b3B0aW9uIHZhbHVlPSJoYWlrdSI+SGFpa3U8L29wdGlvbj4KICAgICAgICA8b3B0aW9uIHZhbHVlPSJmYWJsZSI+RmFibGU8L29wdGlvbj4KICAgICAgPC9zZWxlY3Q+CiAgICAgIDxsYWJlbCBjbGFzcz0icHYtc2xpZGVyLWxhYmVsIiB0aXRsZT0iU2ltdWxhdGVkIHVzYWdlIHBlcmNlbnRhZ2UgZm9yIHByb2dyZXNzIGJhcnMiPlVzYWdlCiAgICAgICAgPGlucHV0IHR5cGU9InJhbmdlIiBpZD0icHYtdXNhZ2UiIG1pbj0iMCIgbWF4PSIxMDAiIHZhbHVlPSI0MiIgb25pbnB1dD0iZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3B2LXVzYWdlLXZhbCcpLnRleHRDb250ZW50PXRoaXMudmFsdWUrJyUnO3JlbmRlclByZXZpZXcoKSI+CiAgICAgICAgPHNwYW4gaWQ9InB2LXVzYWdlLXZhbCI+NDIlPC9zcGFuPgogICAgICA8L2xhYmVsPgogICAgPC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBpZD0icHJldmlldyI+PC9kaXY+CjwvZGl2PgoKPCEtLSBGb3JtIC0tPgo8ZGl2IGNsYXNzPSJtYWluIj4KICA8ZGl2IGNsYXNzPSJicmFuZCI+CiAgICA8aDE+UHJpc21hdGljPC9oMT4KICAgIDxzcGFuIGNsYXNzPSJoMS1zdWIiPsK3IENsYXVkZSBDb2RlIFN0YXR1cyBMaW5lPC9zcGFuPgogIDwvZGl2PgogIDxwIGNsYXNzPSJzdWIiPkRlc2lnbiB5b3VyIHN0YXR1cyBsaW5lIHZpc3VhbGx5LCB0aGVuIGNsaWNrIDxiPkNvcHkgWUFNTDwvYj4gYW5kIHNhdmUgaXQgdG8gPGNvZGU+fi8uY2xhdWRlL3N0YXR1c2xpbmVfY29uZmlnLnltbDwvY29kZT4uIEV2ZXJ5dGhpbmcgdXBkYXRlcyBpbiB0aGUgbGl2ZSBwcmV2aWV3IGFib3ZlLjwvcD4KCiAgPGRpdiBjbGFzcz0iZ3JpZCI+CgogICAgPCEtLSBTdHlsZSAtLT4KICAgIDxkaXYgY2xhc3M9ImNhcmQiPgogICAgICA8ZGl2IGNsYXNzPSJjYXJkLXRpdGxlIj5TdHlsZTwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJmaWVsZCI+CiAgICAgICAgPHNwYW4gY2xhc3M9ImZpZWxkLWxhYmVsIj5QaWxsIHN0eWxlIDxzcGFuIGNsYXNzPSJpbmZvIiBkYXRhLXRpcD0iTmVyZCBGb250IHJlcXVpcmVzIGEgcGF0Y2hlZCBmb250IGluc3RhbGxlZC4gVW5pY29kZSBhbmQgQVNDSUkgd29yayBvbiBhbnkgdGVybWluYWwuIj5pPC9zcGFuPjwvc3Bhbj4KICAgICAgICA8c2VsZWN0IGlkPSJzdHlsZSIgb25jaGFuZ2U9InVwZGF0ZSgpIj4KICAgICAgICAgIDxvcHRpb24gdmFsdWU9Im5lcmQiPk5lcmQgRm9udDwvb3B0aW9uPgogICAgICAgICAgPG9wdGlvbiB2YWx1ZT0idW5pY29kZSIgc2VsZWN0ZWQ+VW5pY29kZTwvb3B0aW9uPgogICAgICAgICAgPG9wdGlvbiB2YWx1ZT0iYXNjaWkiPkFTQ0lJPC9vcHRpb24+CiAgICAgICAgPC9zZWxlY3Q+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJmaWVsZC1wYWlyIj4KICAgICAgICA8ZGl2IGNsYXNzPSJmaWVsZCI+CiAgICAgICAgICA8c3BhbiBjbGFzcz0iZmllbGQtbGFiZWwiPkxhYmVscyA8c3BhbiBjbGFzcz0iaW5mbyIgZGF0YS10aXA9IlNob3cgYSB0ZXh0IGxhYmVsIHJvdyBiZWxvdyBlYWNoIHBpbGwgc2VnbWVudC4iPmk8L3NwYW4+PC9zcGFuPgogICAgICAgICAgPGxhYmVsIGNsYXNzPSJ0b2dnbGUiPjxpbnB1dCB0eXBlPSJjaGVja2JveCIgaWQ9InNob3dfbGFiZWxzIiBjaGVja2VkIG9uY2hhbmdlPSJ1cGRhdGUoKSI+PHNwYW4+PC9zcGFuPjwvbGFiZWw+CiAgICAgICAgPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0iZmllbGQiPgogICAgICAgICAgPHNwYW4gY2xhc3M9ImZpZWxkLWxhYmVsIj5GcmFtZSA8c3BhbiBjbGFzcz0iaW5mbyIgZGF0YS10aXA9IlJvdW5kZWQgYm9yZGVyIGFyb3VuZCB0aGUgc3RhdHVzIGxpbmUuIj5pPC9zcGFuPjwvc3Bhbj4KICAgICAgICAgIDxsYWJlbCBjbGFzcz0idG9nZ2xlIj48aW5wdXQgdHlwZT0iY2hlY2tib3giIGlkPSJmcmFtZV9lbmFibGVkIiBjaGVja2VkIG9uY2hhbmdlPSJ1cGRhdGUoKSI+PHNwYW4+PC9zcGFuPjwvbGFiZWw+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJmaWVsZCI+CiAgICAgICAgPHNwYW4gY2xhc3M9ImZpZWxkLWxhYmVsIj5QYXRoIGRlcHRoIDxzcGFuIGNsYXNzPSJpbmZvIiBkYXRhLXRpcD0iSG93IG1hbnkgZGlyZWN0b3J5IGxldmVscyB0byBzaG93LiAyID0gbGFzdCB0d28gZm9sZGVycy4iPmk8L3NwYW4+PC9zcGFuPgogICAgICAgIDxpbnB1dCB0eXBlPSJudW1iZXIiIGlkPSJwYXRoX3NlZ21lbnRzIiB2YWx1ZT0iMiIgbWluPSIxIiBtYXg9IjEwIiBvbmNoYW5nZT0idXBkYXRlKCkiPgogICAgICA8L2Rpdj4KICAgIDwvZGl2PgoKICAgIDwhLS0gVXNhZ2UgJiBjb3N0IGluZm8gLS0+CiAgICA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgICAgPGRpdiBjbGFzcz0iY2FyZC10aXRsZSI+VXNhZ2UgJmFtcDsgQ29zdDwvZGl2PgogICAgICA8cCBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tZGltKTtsaW5lLWhlaWdodDoxLjc7bWFyZ2luOjAiPgogICAgICAgIFRoZSA8YiBzdHlsZT0iY29sb3I6dmFyKC0tdGV4dCkiPlVTQUdFPC9iPiBwaWxsIHNob3dzIHlvdXIgQ2xhdWRlIDxiIHN0eWxlPSJjb2xvcjp2YXIoLS10ZXh0KSI+UHJvL01heDwvYj4KICAgICAgICByYXRlLWxpbWl0IHBlcmNlbnRhZ2UgYW5kIHJlc2V0IHRpbWUuIEl0IGF1dG8taGlkZXMgb24gQVBJIC8gcGF5LXBlci11c2UgcGxhbnMsIHdoaWNoIHJlY2VpdmUgbm8KICAgICAgICByYXRlLWxpbWl0IGRhdGEgZnJvbSBDbGF1ZGUgQ29kZS4gVG9nZ2xlIDxiIHN0eWxlPSJjb2xvcjp2YXIoLS10ZXh0KSI+N2Q8L2I+IG9uIHRoZSBVU0FHRSBzZWdtZW50IHRvIGFsc28KICAgICAgICBzaG93IHRoZSB3ZWVrbHkgd2luZG93Ljxicj48YnI+CiAgICAgICAgVGhlIDxiIHN0eWxlPSJjb2xvcjp2YXIoLS10ZXh0KSI+Q09TVDwvYj4gcGlsbCBzaG93cyB0aGUgZXN0aW1hdGVkIGNvc3Qgb2YgdGhlCiAgICAgICAgPGIgc3R5bGU9ImNvbG9yOnZhcigtLXRleHQpIj5jdXJyZW50IHNlc3Npb248L2I+IChhIGNsaWVudC1zaWRlIGVzdGltYXRlIGZyb20gQ2xhdWRlIENvZGUgdGhhdCBtYXkgZGlmZmVyCiAgICAgICAgZnJvbSB5b3VyIGFjdHVhbCBiaWxsKS4gVGhlcmUgaXMgbm8gbW9udGhseS1idWRnZXQgdHJhY2tpbmcg4oCUIENsYXVkZSBDb2RlIGRvZXMgbm90IGV4cG9zZSBjdW11bGF0aXZlIHNwZW5kLgogICAgICA8L3A+CiAgICA8L2Rpdj4KCiAgICA8IS0tIFNlZ21lbnRzIC0tPgogICAgPGRpdiBjbGFzcz0iY2FyZCBmdWxsIj4KICAgICAgPGRpdiBjbGFzcz0iY2FyZC10aXRsZSI+U2VnbWVudHMgPHNwYW4gY2xhc3M9ImluZm8iIGRhdGEtdGlwPSJFYWNoIHNlZ21lbnQgaXMgYSBwaWxsLiBEcmFnIHRvIHJlb3JkZXIsIHRvZ2dsZSB0byBzaG93L2hpZGUuIj5pPC9zcGFuPjwvZGl2PgogICAgICA8ZGl2IGlkPSJwaWxsLWxpc3QiPjwvZGl2PgogICAgPC9kaXY+CgogICAgPCEtLSBDb2xvcnMgLS0+CiAgICA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgICAgPGRpdiBjbGFzcz0iY2FyZC10aXRsZSI+Q29sb3JzPC9kaXY+CiAgICAgIDxkaXYgaWQ9ImNvbG9yLWdyaWQiPjwvZGl2PgogICAgPC9kaXY+CgogICAgPCEtLSBNb2RlbCBUaGVtZXMgKyBUaHJlc2hvbGRzIHN0YWNrZWQgLS0+CiAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDoxMnB4Ij4KICAgICAgPGRpdiBjbGFzcz0iY2FyZCI+CiAgICAgICAgPGRpdiBjbGFzcz0iY2FyZC10aXRsZSI+TW9kZWwgR3JhZGllbnRzIDxzcGFuIGNsYXNzPSJpbmZvIiBkYXRhLXRpcD0iVHdvLWNvbG9yIGdyYWRpZW50IGFwcGxpZWQgdG8gdGhlIG1vZGVsIG5hbWUuIEF1dG9tYXRpY2FsbHkgbWF0Y2hlZCBieSBtb2RlbCBJRC4iPmk8L3NwYW4+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0ibW9kZWwtdGhlbWVzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9ImNhcmQiPgogICAgICAgIDxkaXYgY2xhc3M9ImNhcmQtdGl0bGUiPlRocmVzaG9sZHMgPHNwYW4gY2xhc3M9ImluZm8iIGRhdGEtdGlwPSJQcm9ncmVzcyBiYXIgY29sb3JzIGJhc2VkIG9uIHBlcmNlbnRhZ2UgZmlsbGVkLiI+aTwvc3Bhbj48L2Rpdj4KICAgICAgICA8ZGl2IGlkPSJ0aHJlc2hvbGRzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L2Rpdj4KCiAgICA8IS0tIEluc3RydWN0aW9ucyArIEJ1dHRvbnMgLS0+CiAgICA8ZGl2IGNsYXNzPSJmdWxsIj4KICAgICAgPGRpdiBjbGFzcz0iaW5zdHJ1Y3Rpb25zIj4KICAgICAgICA8Yj5Ib3cgdG8gaW5zdGFsbDwvYj4KICAgICAgICA8b2w+CiAgICAgICAgICA8bGk+UGxhY2UgPGNvZGU+c3RhdHVzbGluZS5qczwvY29kZT4gaW4gPGNvZGU+fi8uY2xhdWRlLzwvY29kZT48L2xpPgogICAgICAgICAgPGxpPkFkZCB0aGlzIHRvIHlvdXIgPGNvZGU+fi8uY2xhdWRlL3NldHRpbmdzLmpzb248L2NvZGU+Ojxicj4KICAgICAgICAgICAgPGNvZGU+InN0YXR1c0xpbmUiOiB7ICJ0eXBlIjogImNvbW1hbmQiLCAiY29tbWFuZCI6ICJub2RlIH4vLmNsYXVkZS9zdGF0dXNsaW5lLmpzIiB9PC9jb2RlPjwvbGk+CiAgICAgICAgICA8bGk+PGk+KE9wdGlvbmFsKTwvaT4gQ29weSBvciBkb3dubG9hZCB0aGUgWUFNTCBiZWxvdyBhbmQgc2F2ZSBpdCBhcyA8Y29kZT5+Ly5jbGF1ZGUvc3RhdHVzbGluZV9jb25maWcueW1sPC9jb2RlPi4gSWYgeW91IHNraXAgdGhpcywgdGhlIHNjcmlwdCBjcmVhdGVzIGl0IHdpdGggZGVmYXVsdHMgb24gZmlyc3QgcnVuLjwvbGk+CiAgICAgICAgICA8bGk+UmVzdGFydCBDbGF1ZGUgQ29kZTwvbGk+CiAgICAgICAgPC9vbD4KICAgICAgICA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZGltKSI+RnVsbCBndWlkZSAmYW1wOyBOZXJkIEZvbnQgc2V0dXA6IDxjb2RlPmdpdGh1Yi5jb20vWHl6RWxpYXMvcHJpc21hdGljLWNsYXVkZS1zdGF0dXNsaW5lPC9jb2RlPjwvc3Bhbj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9ImFjdGlvbnMiPgogICAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBidG4tcHJpbWFyeSIgb25jbGljaz0ic2hvd1lhbWwoKSI+Q29weSBZQU1MPC9idXR0b24+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJkb3dubG9hZFlhbWwoKSI+RG93bmxvYWQ8L2J1dHRvbj4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9InJlc2V0RGVmYXVsdHMoKSI+UmVzZXQ8L2J1dHRvbj4KICAgICAgPC9kaXY+CiAgICA8L2Rpdj4KCiAgPC9kaXY+CjwvZGl2PgoKPCEtLSBNb2RhbCAtLT4KPGRpdiBjbGFzcz0ib3ZlcmxheSIgaWQ9InlhbWwtbW9kYWwiIG9uY2xpY2s9ImlmKGV2ZW50LnRhcmdldD09PXRoaXMpY2xvc2VNb2RhbCgpIj4KICA8ZGl2IGNsYXNzPSJtb2RhbCI+CiAgICA8aDM+WW91ciBDb25maWd1cmF0aW9uPC9oMz4KICAgIDxwcmUgaWQ9InlhbWwtb3V0cHV0Ij48L3ByZT4KICAgIDxkaXYgY2xhc3M9ImFjdGlvbnMiPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLXByaW1hcnkiIG9uY2xpY2s9ImNvcHlZYW1sKCkiPkNvcHkgdG8gQ2xpcGJvYXJkPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iZG93bmxvYWRZYW1sKCkiPkRvd25sb2FkIEZpbGU8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJjbG9zZU1vZGFsKCkiPkNsb3NlPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2Rpdj4KPC9kaXY+CjxkaXYgY2xhc3M9InRvYXN0IiBpZD0idG9hc3QiPjwvZGl2PgoKPHNjcmlwdD4KY29uc3QgREVGQVVMVFM9e3N0eWxlOiJ1bmljb2RlIixzaG93X2xhYmVsczp0cnVlLHBhdGhfc2VnbWVudHM6MixmcmFtZTp7ZW5hYmxlZDp0cnVlLHRvcF9sZWZ0OiJcdTI1NmQiLHRvcF9yaWdodDoiXHUyNTZlIixib3RfbGVmdDoiXHUyNTcwIixib3RfcmlnaHQ6Ilx1MjU2ZiIsaG9yaXpvbnRhbDoiXHUyNTAwIix2ZXJ0aWNhbDoiXHUyNTAyIn0scGlsbHM6e21vZGVsOntlbmFibGVkOnRydWUsbGFiZWw6Ik1PREVMIixvcmRlcjoxfSxwYXRoOntlbmFibGVkOnRydWUsbGFiZWw6IlBBVEgiLG9yZGVyOjJ9LGNvbnRleHQ6e2VuYWJsZWQ6dHJ1ZSxsYWJlbDoiQ09OVEVYVCIsb3JkZXI6MyxiYXJfd2lkdGg6MTB9LHJhdGU6e2VuYWJsZWQ6dHJ1ZSxsYWJlbDoiVVNBR0UiLG9yZGVyOjQsYmFyX3dpZHRoOjEwLHNob3dfc2V2ZW5fZGF5OmZhbHNlfSxkaWZmOntlbmFibGVkOnRydWUsbGFiZWw6IkRJRkYiLG9yZGVyOjV9LGNvc3Q6e2VuYWJsZWQ6dHJ1ZSxsYWJlbDoiQ09TVCIsb3JkZXI6Nn0sdGltZTp7ZW5hYmxlZDp0cnVlLGxhYmVsOiJUSU1FIixvcmRlcjo3fX0sY29sb3JzOntwaWxsX2JnOls1OCw2Miw3Ml0sZnJhbWU6WzEyMCwxMjAsMTM4XSxsYWJlbDpbMTIwLDEyMCwxMzhdLGRpbTpbMjAwLDE4NSwxNzVdLHBhdGg6WzEyMCwyMDAsMjU1XSx0aW1lOlsxMzAsMjEwLDI1NV0sZGlmZl9hZGQ6WzYwLDI1NSwxMTBdLGRpZmZfc2VwOls3MCw5NSw5MF0sZGlmZl9ybTpbMjU1LDc1LDc1XSxjb3N0X2dyYWQ6W1syNTUsMjIwLDYwXSxbMjU1LDE3MCwzMF1dLG1vZGVsX3RoZW1lczp7b3B1czpbWzE3NSwxMDAsMjU1XSxbMjU1LDEyMCwyMzBdXSxzb25uZXQ6W1s0MCwyMzAsMTYwXSxbMTIwLDI1NSwxODBdXSxoYWlrdTpbWzI1NSwxNDAsNjBdLFsyNTUsOTAsMTQwXV0sZmFibGU6W1s2NCwyMjQsMjA4XSxbMjU1LDE5OCw4OF1dLGZhbGxiYWNrOltbMjAwLDIwMCwyMzBdLFsyNDAsMjQwLDI1NV1dfSx0aHJlc2hvbGRzOlt7YmVsb3c6NDAsY29sb3I6WzUwLDI1NSwxNjBdfSx7YmVsb3c6NjUsY29sb3I6WzIwMCwyNTUsNTBdfSx7YmVsb3c6ODAsY29sb3I6WzI1NSwyMTAsMzBdfSx7YmVsb3c6OTIsY29sb3I6WzI1NSwxMjAsMzBdfSx7YmVsb3c6MTAxLGNvbG9yOlsyNTUsNTAsNTBdfV19fTsKY29uc3QgU1RZTEVfQ0hBUlM9e25lcmQ6e2xlZnQ6Ilx1ZTBiNiIscmlnaHQ6Ilx1ZTBiNCJ9LHVuaWNvZGU6e2xlZnQ6Ilx1MjU5MCIscmlnaHQ6Ilx1MjU4YyJ9LGFzY2lpOntsZWZ0OiJbIixyaWdodDoiXSJ9fTsKY29uc3QgUElMTF9LRVlTPVsibW9kZWwiLCJwYXRoIiwiY29udGV4dCIsInJhdGUiLCJkaWZmIiwiY29zdCIsInRpbWUiXTsKY29uc3QgUElMTF9JTkZPPXttb2RlbDoiU2hvd3MgdGhlIGFjdGl2ZSBDbGF1ZGUgbW9kZWwgbmFtZSB3aXRoIGEgY29sb3JlZCBncmFkaWVudC4iLHBhdGg6IkN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnksIHRydW5jYXRlZCB0byB0aGUgY29uZmlndXJlZCBkZXB0aC4iLGNvbnRleHQ6IkhvdyBtdWNoIG9mIHRoZSBjb250ZXh0IHdpbmRvdyBpcyB1c2VkLCB3aXRoIGEgcHJvZ3Jlc3MgYmFyLiIscmF0ZToiU3Vic2NyaXB0aW9uIHVzYWdlIChDbGF1ZGUgUHJvL01heCk6IDUtaG91ciByYXRlLWxpbWl0IHBlcmNlbnRhZ2UgYW5kIHJlc2V0IHRpbWUuIEF1dG9tYXRpY2FsbHkgaGlkZGVuIG9uIEFQSSAvIHBheS1wZXItdXNlIHBsYW5zLCB3aGljaCByZWNlaXZlIG5vIHJhdGUtbGltaXQgZGF0YS4iLGRpZmY6IkxpbmVzIGFkZGVkIGFuZCByZW1vdmVkIGluIHRoZSBjdXJyZW50IHNlc3Npb24uIixjb3N0OiJFc3RpbWF0ZWQgY29zdCBvZiB0aGUgY3VycmVudCBzZXNzaW9uIChjbGllbnQtc2lkZSBlc3RpbWF0ZSkuIix0aW1lOiJIb3cgbG9uZyB0aGUgY3VycmVudCBzZXNzaW9uIGhhcyBiZWVuIHJ1bm5pbmcuIn07CmNvbnN0IENPTE9SX0ZJRUxEUz1bWyJjb2xvcnMucGlsbF9iZyIsIlBpbGwgQkciLCJCYWNrZ3JvdW5kIGNvbG9yIG9mIGFsbCBwaWxsIHNlZ21lbnRzLiJdLFsiY29sb3JzLmZyYW1lIiwiRnJhbWUiLCJCb3JkZXIgZnJhbWUgY29sb3IuIl0sWyJjb2xvcnMubGFiZWwiLCJMYWJlbHMiLCJMYWJlbCB0ZXh0IGNvbG9yIGJlbG93IHBpbGxzLiJdLFsiY29sb3JzLmRpbSIsIkRpbSB0ZXh0IiwiU2Vjb25kYXJ5IHRleHQgKHVuaXRzLCBzZXBhcmF0b3JzKS4iXSxbImNvbG9ycy5wYXRoIiwiUGF0aCIsIkRpcmVjdG9yeSBwYXRoIHRleHQgY29sb3IuIl0sWyJjb2xvcnMudGltZSIsIlRpbWUiLCJTZXNzaW9uIGR1cmF0aW9uIHRleHQgY29sb3IuIl0sWyJjb2xvcnMuZGlmZl9hZGQiLCJEaWZmICsiLCJBZGRlZCBsaW5lcyBjb2xvci4iXSxbImNvbG9ycy5kaWZmX3NlcCIsIkRpZmYgc2VwIiwiU2VwYXJhdG9yIGJldHdlZW4gKy8tLiJdLFsiY29sb3JzLmRpZmZfcm0iLCJEaWZmIOKIkiIsIlJlbW92ZWQgbGluZXMgY29sb3IuIl1dOwoKbGV0IHN0YXRlPUpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoREVGQVVMVFMpKTsKCmZ1bmN0aW9uIHJnYkhleChbcixnLGJdKXtyZXR1cm4iIyIrW3IsZyxiXS5tYXAodj0+di50b1N0cmluZygxNikucGFkU3RhcnQoMiwiMCIpKS5qb2luKCIiKX0KZnVuY3Rpb24gaGV4UmdiKGgpe2NvbnN0IG09aC5tYXRjaCgvWzAtOWEtZl17Mn0vZ2kpO3JldHVybiBtP20ubWFwKHY9PnBhcnNlSW50KHYsMTYpKTpbMCwwLDBdfQpmdW5jdGlvbiBnZXQocCl7bGV0IG49c3RhdGU7Zm9yKGNvbnN0IGsgb2YgcC5zcGxpdCgiLiIpKXtuPW4/LltrXX1yZXR1cm4gbn0KZnVuY3Rpb24gc2V0KHAsdil7Y29uc3Qgaz1wLnNwbGl0KCIuIik7bGV0IG49c3RhdGU7Zm9yKGxldCBpPTA7aTxrLmxlbmd0aC0xO2krKyluPW5ba1tpXV07bltrW2subGVuZ3RoLTFdXT12fQoKZnVuY3Rpb24gYnVpbGRQaWxscygpewogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJwaWxsLWxpc3QiKTtlbC5pbm5lckhUTUw9IiI7CiAgY29uc3Qgc29ydGVkPVBJTExfS0VZUy5zbGljZSgpLnNvcnQoKGEsYik9PnN0YXRlLnBpbGxzW2FdLm9yZGVyLXN0YXRlLnBpbGxzW2JdLm9yZGVyKTsKICBzb3J0ZWQuZm9yRWFjaChrZXk9PnsKICAgIGNvbnN0IHA9c3RhdGUucGlsbHNba2V5XTtjb25zdCBoYXNCYXI9WyJjb250ZXh0IiwicmF0ZSJdLmluY2x1ZGVzKGtleSk7CiAgICBjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoImRpdiIpO2QuY2xhc3NOYW1lPSJwaWxsLWl0ZW0iO2QuZHJhZ2dhYmxlPXRydWU7ZC5kYXRhc2V0LmtleT1rZXk7CiAgICBkLmlubmVySFRNTD1gPHNwYW4gY2xhc3M9ImhhbmRsZSI+JiN4MjYzMDs8L3NwYW4+YAogICAgICArYDxsYWJlbCBjbGFzcz0idG9nZ2xlIj48aW5wdXQgdHlwZT0iY2hlY2tib3giICR7cC5lbmFibGVkPyJjaGVja2VkIjoiIn0gb25jaGFuZ2U9InN0YXRlLnBpbGxzWycke2tleX0nXS5lbmFibGVkPXRoaXMuY2hlY2tlZDt1cGRhdGUoKSI+PHNwYW4+PC9zcGFuPjwvbGFiZWw+YAogICAgICArYDxzcGFuIGNsYXNzPSJuYW1lIj4ke2tleX08L3NwYW4+YAogICAgICArYDxpbnB1dCB0eXBlPSJ0ZXh0IiB2YWx1ZT0iJHtwLmxhYmVsfSIgb25jaGFuZ2U9InN0YXRlLnBpbGxzWycke2tleX0nXS5sYWJlbD10aGlzLnZhbHVlO3VwZGF0ZSgpIj5gCiAgICAgICsoaGFzQmFyP2A8c3BhbiBjbGFzcz0iYmFyLWxhYmVsIj5iYXI8L3NwYW4+PGlucHV0IHR5cGU9Im51bWJlciIgdmFsdWU9IiR7cC5iYXJfd2lkdGh8fDEwfSIgbWluPSIzIiBtYXg9IjMwIiBvbmNoYW5nZT0ic3RhdGUucGlsbHNbJyR7a2V5fSddLmJhcl93aWR0aD0rdGhpcy52YWx1ZTt1cGRhdGUoKSI+YDoiIikKICAgICAgKyhrZXk9PT0icmF0ZSI/YDxsYWJlbCBjbGFzcz0iYmFyLWxhYmVsIiBzdHlsZT0iZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6M3B4IiB0aXRsZT0iQWxzbyBzaG93IHRoZSA3LWRheSB1c2FnZSB3aW5kb3ciPjdkPGlucHV0IHR5cGU9ImNoZWNrYm94IiAke3Auc2hvd19zZXZlbl9kYXk/ImNoZWNrZWQiOiIifSBvbmNoYW5nZT0ic3RhdGUucGlsbHMucmF0ZS5zaG93X3NldmVuX2RheT10aGlzLmNoZWNrZWQ7dXBkYXRlKCkiPjwvbGFiZWw+YDoiIikKICAgICAgK2A8c3BhbiBjbGFzcz0iaW5mbyIgZGF0YS10aXA9IiR7UElMTF9JTkZPW2tleV18fCcnfSI+aTwvc3Bhbj5gOwogICAgZWwuYXBwZW5kQ2hpbGQoZCk7CiAgfSk7CiAgaW5pdERyYWcoKTsKfQoKZnVuY3Rpb24gYnVpbGRDb2xvcnMoKXsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiY29sb3ItZ3JpZCIpO2VsLmlubmVySFRNTD0iIjsKICBDT0xPUl9GSUVMRFMuZm9yRWFjaCgoW3AsbGFiZWwsdGlwXSk9PnsKICAgIGNvbnN0IHY9Z2V0KHApO2NvbnN0IGQ9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgiZGl2Iik7ZC5jbGFzc05hbWU9ImZpZWxkIjsKICAgIGQuaW5uZXJIVE1MPWA8c3BhbiBjbGFzcz0iZmllbGQtbGFiZWwiPiR7bGFiZWx9IDxzcGFuIGNsYXNzPSJpbmZvIiBkYXRhLXRpcD0iJHt0aXB9Ij5pPC9zcGFuPjwvc3Bhbj48ZGl2IGNsYXNzPSJmaWVsZC1jb2xvciI+PGlucHV0IHR5cGU9ImNvbG9yIiB2YWx1ZT0iJHtyZ2JIZXgodil9IiBvbmNoYW5nZT0ic2V0KCcke3B9JyxoZXhSZ2IodGhpcy52YWx1ZSkpO3VwZGF0ZSgpIj48L2Rpdj5gOwogICAgZWwuYXBwZW5kQ2hpbGQoZCk7CiAgfSk7CiAgY29uc3QgY2c9c3RhdGUuY29sb3JzLmNvc3RfZ3JhZDtjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoImRpdiIpO2QuY2xhc3NOYW1lPSJmaWVsZCI7CiAgZC5pbm5lckhUTUw9YDxzcGFuIGNsYXNzPSJmaWVsZC1sYWJlbCI+Q29zdCBncmFkIDxzcGFuIGNsYXNzPSJpbmZvIiBkYXRhLXRpcD0iVHdvLWNvbG9yIGdyYWRpZW50IGZvciBjb3N0IHRleHQuIj5pPC9zcGFuPjwvc3Bhbj48ZGl2IGNsYXNzPSJmaWVsZC1jb2xvciI+PGlucHV0IHR5cGU9ImNvbG9yIiB2YWx1ZT0iJHtyZ2JIZXgoY2dbMF0pfSIgb25jaGFuZ2U9InN0YXRlLmNvbG9ycy5jb3N0X2dyYWRbMF09aGV4UmdiKHRoaXMudmFsdWUpO3VwZGF0ZSgpIj48c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZGltKTtmb250LXNpemU6MTFweCI+XHUyMTkyPC9zcGFuPjxpbnB1dCB0eXBlPSJjb2xvciIgdmFsdWU9IiR7cmdiSGV4KGNnWzFdKX0iIG9uY2hhbmdlPSJzdGF0ZS5jb2xvcnMuY29zdF9ncmFkWzFdPWhleFJnYih0aGlzLnZhbHVlKTt1cGRhdGUoKSI+PC9kaXY+YDsKICBlbC5hcHBlbmRDaGlsZChkKTsKfQoKZnVuY3Rpb24gYnVpbGRUaGVtZXMoKXsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgibW9kZWwtdGhlbWVzIik7ZWwuaW5uZXJIVE1MPSIiOwogIGNvbnN0IGxhYmVscz17b3B1czoiT3B1cyIsc29ubmV0OiJTb25uZXQiLGhhaWt1OiJIYWlrdSIsZmFibGU6IkZhYmxlIixmYWxsYmFjazoiT3RoZXIifTsKICBmb3IoY29uc3RbbmFtZSxncmFkXW9mIE9iamVjdC5lbnRyaWVzKHN0YXRlLmNvbG9ycy5tb2RlbF90aGVtZXMpKXsKICAgIGNvbnN0IGQ9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgiZGl2Iik7ZC5jbGFzc05hbWU9ImdyYWQiOwogICAgZC5pbm5lckhUTUw9YDxzcGFuIGNsYXNzPSJsYWJlbCI+JHtsYWJlbHNbbmFtZV18fG5hbWV9PC9zcGFuPjxpbnB1dCB0eXBlPSJjb2xvciIgdmFsdWU9IiR7cmdiSGV4KGdyYWRbMF0pfSIgb25jaGFuZ2U9InN0YXRlLmNvbG9ycy5tb2RlbF90aGVtZXNbJyR7bmFtZX0nXVswXT1oZXhSZ2IodGhpcy52YWx1ZSk7dXBkYXRlKCkiPjxzcGFuIGNsYXNzPSJhcnJvdyI+XHUyMTkyPC9zcGFuPjxpbnB1dCB0eXBlPSJjb2xvciIgdmFsdWU9IiR7cmdiSGV4KGdyYWRbMV0pfSIgb25jaGFuZ2U9InN0YXRlLmNvbG9ycy5tb2RlbF90aGVtZXNbJyR7bmFtZX0nXVsxXT1oZXhSZ2IodGhpcy52YWx1ZSk7dXBkYXRlKCkiPmA7CiAgICBlbC5hcHBlbmRDaGlsZChkKTsKICB9Cn0KCmZ1bmN0aW9uIGJ1aWxkVGhyZXNob2xkcygpewogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJ0aHJlc2hvbGRzIik7ZWwuaW5uZXJIVE1MPSIiOwogIHN0YXRlLmNvbG9ycy50aHJlc2hvbGRzLmZvckVhY2goKHQsaSk9PnsKICAgIGNvbnN0IGlzTGFzdD1pPT09c3RhdGUuY29sb3JzLnRocmVzaG9sZHMubGVuZ3RoLTE7CiAgICBjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoImRpdiIpO2QuY2xhc3NOYW1lPSJ0aHIiOwogICAgaWYoaXNMYXN0KXsKICAgICAgZC5pbm5lckhUTUw9YDxzcGFuIGNsYXNzPSJ0aHItbGFiZWwiPjEwMCUrPC9zcGFuPjxpbnB1dCB0eXBlPSJjb2xvciIgdmFsdWU9IiR7cmdiSGV4KHQuY29sb3IpfSIgb25jaGFuZ2U9InN0YXRlLmNvbG9ycy50aHJlc2hvbGRzWyR7aX1dLmNvbG9yPWhleFJnYih0aGlzLnZhbHVlKTt1cGRhdGUoKSI+YDsKICAgIH1lbHNlewogICAgICBkLmlubmVySFRNTD1gPHNwYW4gY2xhc3M9InRoci1sYWJlbCI+Jmx0Ozwvc3Bhbj48aW5wdXQgdHlwZT0ibnVtYmVyIiB2YWx1ZT0iJHt0LmJlbG93fSIgbWluPSIwIiBtYXg9IjEwMCIgb25jaGFuZ2U9InN0YXRlLmNvbG9ycy50aHJlc2hvbGRzWyR7aX1dLmJlbG93PSt0aGlzLnZhbHVlO3VwZGF0ZSgpIj48c3BhbiBjbGFzcz0idGhyLWxhYmVsIj4lPC9zcGFuPjxpbnB1dCB0eXBlPSJjb2xvciIgdmFsdWU9IiR7cmdiSGV4KHQuY29sb3IpfSIgb25jaGFuZ2U9InN0YXRlLmNvbG9ycy50aHJlc2hvbGRzWyR7aX1dLmNvbG9yPWhleFJnYih0aGlzLnZhbHVlKTt1cGRhdGUoKSI+YDsKICAgIH0KICAgIGVsLmFwcGVuZENoaWxkKGQpOwogIH0pOwp9CgpmdW5jdGlvbiBpbml0RHJhZygpewogIGNvbnN0IGxpc3Q9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInBpbGwtbGlzdCIpO2xldCBkcmFnZ2VkPW51bGw7CiAgbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCIucGlsbC1pdGVtIikuZm9yRWFjaChpdGVtPT57CiAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoImRyYWdzdGFydCIsKCk9PntkcmFnZ2VkPWl0ZW07aXRlbS5jbGFzc0xpc3QuYWRkKCJkcmFnZ2luZyIpfSk7CiAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoImRyYWdlbmQiLCgpPT57CiAgICAgIGl0ZW0uY2xhc3NMaXN0LnJlbW92ZSgiZHJhZ2dpbmciKTtkcmFnZ2VkPW51bGw7CiAgICAgIGxpc3QucXVlcnlTZWxlY3RvckFsbCgiLnBpbGwtaXRlbSIpLmZvckVhY2goKGVsLGkpPT57c3RhdGUucGlsbHNbZWwuZGF0YXNldC5rZXldLm9yZGVyPWkrMX0pOwogICAgICB1cGRhdGUoKTsKICAgIH0pOwogICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKCJkcmFnb3ZlciIsZT0+ewogICAgICBlLnByZXZlbnREZWZhdWx0KCk7aWYoaXRlbT09PWRyYWdnZWQpcmV0dXJuOwogICAgICBjb25zdCByPWl0ZW0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7CiAgICAgIGlmKGUuY2xpZW50WTxyLnRvcCtyLmhlaWdodC8yKWxpc3QuaW5zZXJ0QmVmb3JlKGRyYWdnZWQsaXRlbSk7CiAgICAgIGVsc2UgbGlzdC5pbnNlcnRCZWZvcmUoZHJhZ2dlZCxpdGVtLm5leHRTaWJsaW5nKTsKICAgIH0pOwogIH0pOwp9CgovLyDilIDilIAgUHJldmlldyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKZnVuY3Rpb24gbGVycChhLGIsdCl7cmV0dXJuIE1hdGgucm91bmQoYSsoYi1hKSp0KX0KZnVuY3Rpb24gcmdiKGMpe3JldHVybmByZ2IoJHtjWzBdfSwke2NbMV19LCR7Y1syXX0pYH0KZnVuY3Rpb24gZXNjKHMpe3JldHVybiBzLnJlcGxhY2UoLyYvZywiJmFtcDsiKS5yZXBsYWNlKC88L2csIiZsdDsiKS5yZXBsYWNlKC8+L2csIiZndDsiKX0KZnVuY3Rpb24gZ3JhZFNwYW5zKHRleHQscyxlKXsKICBjb25zdCBuPU1hdGgubWF4KHRleHQubGVuZ3RoLTEsMSk7CiAgcmV0dXJuWy4uLnRleHRdLm1hcCgoY2gsaSk9Pntjb25zdCBjPVtsZXJwKHNbMF0sZVswXSxpL24pLGxlcnAoc1sxXSxlWzFdLGkvbiksbGVycChzWzJdLGVbMl0saS9uKV07cmV0dXJuYDxzcGFuIHN0eWxlPSJjb2xvcjoke3JnYihjKX0iPiR7ZXNjKGNoKX08L3NwYW4+YH0pLmpvaW4oIiIpOwp9CgpmdW5jdGlvbiByZW5kZXJQcmV2aWV3KCl7CiAgY29uc3Qgcz1zdGF0ZSxiZ1BpbGw9cy5jb2xvcnMucGlsbF9iZyxiZ1N0cj1yZ2IoYmdQaWxsKSxmcmFtZUM9cmdiKHMuY29sb3JzLmZyYW1lKSwKICAgIGxhYmVsQz1yZ2Iocy5jb2xvcnMubGFiZWwpLGRpbUM9cmdiKHMuY29sb3JzLmRpbSksY2g9U1RZTEVfQ0hBUlNbcy5zdHlsZV18fFNUWUxFX0NIQVJTLnVuaWNvZGU7CgogIC8vIFJlYWQgcHJldmlldyBjb250cm9scwogIGNvbnN0IHB2TW9kZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInB2LW1vZGVsIikudmFsdWU7CiAgY29uc3QgcHZVc2FnZT0rZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInB2LXVzYWdlIikudmFsdWU7CgogIGNvbnN0IG1vZGVsTmFtZXM9e29wdXM6IkNsYXVkZSBPcHVzIDQuOCAoMU0pIixzb25uZXQ6IkNsYXVkZSBTb25uZXQgNC42IixoYWlrdToiQ2xhdWRlIEhhaWt1IDQuNSIsZmFibGU6IkNsYXVkZSBGYWJsZSA1In07CiAgY29uc3QgZnVsbFBhdGg9WyJ+IiwiZGV2IiwibXktcHJvamVjdCIsInNyYyIsImNvbXBvbmVudHMiXTsKICBjb25zdCBuU2VnPXMucGF0aF9zZWdtZW50czsKICBjb25zdCBkZW1vUGF0aD1mdWxsUGF0aC5sZW5ndGg+blNlZz8iXHUyMDI2LyIrZnVsbFBhdGguc2xpY2UoLW5TZWcpLmpvaW4oIi8iKTpmdWxsUGF0aC5qb2luKCIvIik7CiAgY29uc3QgZGVtbz17bW9kZWw6bW9kZWxOYW1lc1twdk1vZGVsXXx8bW9kZWxOYW1lcy5vcHVzLHBhdGg6ZGVtb1BhdGgscGN0OnB2VXNhZ2UsY3R4OiIxLjBNIiwKICAgIGNvc3Q6MS44NSx0aW1lOiIxMm0gMzRzIixhZGQ6MTQyLHJtOjM4LHJsUGN0OnB2VXNhZ2UscmxSZXNldDoiMTQ6MzAiLHdlZWtQY3Q6TWF0aC5yb3VuZChwdlVzYWdlKjAuNyksd2Vla1Jlc2V0OiJNb24ifTsKICBjb25zdCB0aGVtZT1zLmNvbG9ycy5tb2RlbF90aGVtZXNbcHZNb2RlbF18fHMuY29sb3JzLm1vZGVsX3RoZW1lcy5mYWxsYmFjazsKCiAgZnVuY3Rpb24gdENvbG9yKHYpe2Zvcihjb25zdCB0IG9mIHMuY29sb3JzLnRocmVzaG9sZHMpe2lmKHY8dC5iZWxvdylyZXR1cm4gdC5jb2xvcn1yZXR1cm4gcy5jb2xvcnMudGhyZXNob2xkcy5hdCgtMSkuY29sb3J9CiAgZnVuY3Rpb24gYmFyKHBjdCx3LGNvbG9yKXsKICAgIGNvbnN0IGZpbGxlZD1NYXRoLm1pbihNYXRoLmZsb29yKHBjdCp3LzEwMCksdyksdHJhY2s9YmdQaWxsLm1hcCh2PT5NYXRoLm1pbigyNTUsdis1NSkpOwogICAgbGV0IG89IiI7Zm9yKGxldCBpPTA7aTx3O2krKyl7CiAgICAgIGlmKGk8ZmlsbGVkKXtjb25zdCB0PWkvTWF0aC5tYXgody0xLDEpO2NvbnN0IGNjPVswLDEsMl0ubWFwKGo9Pk1hdGgubWluKDI1NSxNYXRoLnJvdW5kKGNvbG9yW2pdKigxLXQqWy4yLC4xMiwuMDhdW2pdKSkpKTtvKz1gPHNwYW4gc3R5bGU9ImNvbG9yOiR7cmdiKGNjKX0iPlx1MjUwMTwvc3Bhbj5gfQogICAgICBlbHNlIG8rPWA8c3BhbiBzdHlsZT0iY29sb3I6JHtyZ2IodHJhY2spfSI+XHUyNTAxPC9zcGFuPmAKICAgIH1yZXR1cm4gbzsKICB9CgogIGZ1bmN0aW9uIG1ha2VQaWxsKGlubmVySHRtbCxsYWJlbCl7CiAgICBjb25zdCB0bXA9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgic3BhbiIpO3RtcC5pbm5lckhUTUw9aW5uZXJIdG1sOwogICAgY29uc3QgaW5uZXJMZW49dG1wLnRleHRDb250ZW50Lmxlbmd0aDsKICAgIGNvbnN0IHRvdGFsTGVuPTErMStpbm5lckxlbisxKzE7CiAgICBjb25zdCBodG1sPWA8c3BhbiBzdHlsZT0iY29sb3I6JHtiZ1N0cn0iPiR7ZXNjKGNoLmxlZnQpfTwvc3Bhbj48c3BhbiBzdHlsZT0iYmFja2dyb3VuZDoke2JnU3RyfSI+ICR7aW5uZXJIdG1sfSA8L3NwYW4+PHNwYW4gc3R5bGU9ImNvbG9yOiR7YmdTdHJ9Ij4ke2VzYyhjaC5yaWdodCl9PC9zcGFuPmA7CiAgICByZXR1cm57aHRtbCxsYWJlbCx0ZXh0TGVuOnRvdGFsTGVufTsKICB9CgogIGNvbnN0IHBpbGxzPVtdOwogIGNvbnN0IHNvcnRlZD1PYmplY3QuZW50cmllcyhzLnBpbGxzKS5zb3J0KChhLGIpPT5hWzFdLm9yZGVyLWJbMV0ub3JkZXIpOwogIGZvcihjb25zdFtrZXkscGNmZ11vZiBzb3J0ZWQpewogICAgaWYoIXBjZmcuZW5hYmxlZCljb250aW51ZTtjb25zdCBidz1wY2ZnLmJhcl93aWR0aHx8MTA7Y29uc3QgbGJsPXBjZmcubGFiZWw7CiAgICBpZihrZXk9PT0ibW9kZWwiKXBpbGxzLnB1c2gobWFrZVBpbGwoYDxiPiR7Z3JhZFNwYW5zKGRlbW8ubW9kZWwsdGhlbWVbMF0sdGhlbWVbMV0pfTwvYj5gLGxibCkpOwogICAgZWxzZSBpZihrZXk9PT0icGF0aCIpcGlsbHMucHVzaChtYWtlUGlsbChgPGI+PHNwYW4gc3R5bGU9ImNvbG9yOiR7cmdiKHMuY29sb3JzLnBhdGgpfSI+JHtlc2MoZGVtby5wYXRoKX08L3NwYW4+PC9iPmAsbGJsKSk7CiAgICBlbHNlIGlmKGtleT09PSJjb250ZXh0Iil7Y29uc3QgYz10Q29sb3IocHZVc2FnZSk7cGlsbHMucHVzaChtYWtlUGlsbChgPHNwYW4gc3R5bGU9ImNvbG9yOiR7cmdiKGMpfSI+PGI+JHtwdlVzYWdlfSU8L2I+PC9zcGFuPjxzcGFuIHN0eWxlPSJjb2xvcjoke2RpbUN9Ij4gLyAke2RlbW8uY3R4fSAgPC9zcGFuPiR7YmFyKHB2VXNhZ2UsYncsYyl9YCxsYmwpKX0KICAgIGVsc2UgaWYoa2V5PT09InJhdGUiKXtjb25zdCBjPXRDb2xvcihkZW1vLnJsUGN0KTtsZXQgaHRtbD1gPHNwYW4gc3R5bGU9ImNvbG9yOiR7cmdiKGMpfSI+PGI+JHtkZW1vLnJsUGN0fSU8L2I+PC9zcGFuPiAgJHtiYXIoZGVtby5ybFBjdCxidyxjKX08c3BhbiBzdHlsZT0iY29sb3I6JHtkaW1DfSI+ICAke2RlbW8ucmxSZXNldH08L3NwYW4+YDtpZihwY2ZnLnNob3dfc2V2ZW5fZGF5KXtjb25zdCBjNz10Q29sb3IoZGVtby53ZWVrUGN0KTtodG1sKz1gPHNwYW4gc3R5bGU9ImNvbG9yOiR7ZGltQ30iPiAgwrcgIDwvc3Bhbj48c3BhbiBzdHlsZT0iY29sb3I6JHtyZ2IoYzcpfSI+PGI+N2QgJHtkZW1vLndlZWtQY3R9JTwvYj48L3NwYW4+YH1waWxscy5wdXNoKG1ha2VQaWxsKGh0bWwsbGJsKSl9CiAgICBlbHNlIGlmKGtleT09PSJkaWZmIilwaWxscy5wdXNoKG1ha2VQaWxsKGA8c3BhbiBzdHlsZT0iY29sb3I6JHtyZ2Iocy5jb2xvcnMuZGlmZl9hZGQpfSI+PGI+KyR7ZGVtby5hZGR9PC9iPjwvc3Bhbj48c3BhbiBzdHlsZT0iY29sb3I6JHtyZ2Iocy5jb2xvcnMuZGlmZl9zZXApfSI+ICA8L3NwYW4+PHNwYW4gc3R5bGU9ImNvbG9yOiR7cmdiKHMuY29sb3JzLmRpZmZfcm0pfSI+PGI+XHUyMjEyJHtkZW1vLnJtfTwvYj48L3NwYW4+YCxsYmwpKTsKICAgIGVsc2UgaWYoa2V5PT09ImNvc3QiKXtjb25zdCBjZz1zLmNvbG9ycy5jb3N0X2dyYWQ7cGlsbHMucHVzaChtYWtlUGlsbChgPGI+JHtncmFkU3BhbnMoIiQiK2RlbW8uY29zdC50b0ZpeGVkKDIpLGNnWzBdLGNnWzFdKX08L2I+YCxsYmwpKX0KICAgIGVsc2UgaWYoa2V5PT09InRpbWUiKXBpbGxzLnB1c2gobWFrZVBpbGwoYDxiPjxzcGFuIHN0eWxlPSJjb2xvcjoke3JnYihzLmNvbG9ycy50aW1lKX0iPiR7ZGVtby50aW1lfTwvc3Bhbj48L2I+YCxsYmwpKTsKICB9CgogIGNvbnN0IHBpbGxMaW5lPXBpbGxzLm1hcChwPT5wLmh0bWwpLmpvaW4oIiAiKTsKICBjb25zdCBsYWJlbFBhcnRzPXBpbGxzLm1hcChwPT57CiAgICBjb25zdCBsYmw9cC5sYWJlbHx8IiI7Y29uc3Qgdz1wLnRleHRMZW47CiAgICBjb25zdCBwYWQ9TWF0aC5tYXgoMCx3LWxibC5sZW5ndGgpO2NvbnN0IGxwPU1hdGguZmxvb3IocGFkLzIpOwogICAgcmV0dXJuYDxzcGFuIHN0eWxlPSJjb2xvcjoke2xhYmVsQ30iPiR7IiAiLnJlcGVhdChscCl9JHtlc2MobGJsKX0keyIgIi5yZXBlYXQocGFkLWxwKX08L3NwYW4+YDsKICB9KTsKICBjb25zdCBsYWJlbExpbmU9bGFiZWxQYXJ0cy5qb2luKCIgIik7CiAgY29uc3QgdG90YWxXPXBpbGxzLnJlZHVjZSgoc3VtLHApPT5zdW0rcC50ZXh0TGVuLDApKyhwaWxscy5sZW5ndGg+MT9waWxscy5sZW5ndGgtMTowKTsKCiAgbGV0IGh0bWw9IiI7Y29uc3QgZnI9cy5mcmFtZTsKICBpZihmci5lbmFibGVkKXsKICAgIGNvbnN0IGhDaGFyPWZyLmhvcml6b250YWx8fCJcdTI1MDAiLHZDaGFyPWZyLnZlcnRpY2FsfHwiXHUyNTAyIjsKICAgIGNvbnN0IGhCYXI9ZXNjKGhDaGFyLnJlcGVhdCh0b3RhbFcrMikpOwogICAgaHRtbCs9YDxzcGFuIHN0eWxlPSJjb2xvcjoke2ZyYW1lQ30iPiR7ZXNjKGZyLnRvcF9sZWZ0fHwiXHUyNTZkIil9JHtoQmFyfSR7ZXNjKGZyLnRvcF9yaWdodHx8Ilx1MjU2ZSIpfTwvc3Bhbj5cbmA7CiAgICBodG1sKz1gPHNwYW4gc3R5bGU9ImNvbG9yOiR7ZnJhbWVDfSI+JHtlc2ModkNoYXIpfTwvc3Bhbj4gJHtwaWxsTGluZX0gPHNwYW4gc3R5bGU9ImNvbG9yOiR7ZnJhbWVDfSI+JHtlc2ModkNoYXIpfTwvc3Bhbj5cbmA7CiAgICBpZihzLnNob3dfbGFiZWxzKWh0bWwrPWA8c3BhbiBzdHlsZT0iY29sb3I6JHtmcmFtZUN9Ij4ke2VzYyh2Q2hhcil9PC9zcGFuPiAke2xhYmVsTGluZX0gPHNwYW4gc3R5bGU9ImNvbG9yOiR7ZnJhbWVDfSI+JHtlc2ModkNoYXIpfTwvc3Bhbj5cbmA7CiAgICBodG1sKz1gPHNwYW4gc3R5bGU9ImNvbG9yOiR7ZnJhbWVDfSI+JHtlc2MoZnIuYm90X2xlZnR8fCJcdTI1NzAiKX0ke2hCYXJ9JHtlc2MoZnIuYm90X3JpZ2h0fHwiXHUyNTZmIil9PC9zcGFuPmA7CiAgfWVsc2V7CiAgICBodG1sKz1waWxsTGluZTtpZihzLnNob3dfbGFiZWxzKWh0bWwrPSJcbiIrbGFiZWxMaW5lOwogIH0KICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicHJldmlldyIpLmlubmVySFRNTD1odG1sOwp9CgovLyDilIDilIAgWUFNTCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKZnVuY3Rpb24gZ2VuWWFtbCgpewogIGNvbnN0IHM9c3RhdGUsTD1bXSxjPWE9PmBbJHthLmpvaW4oIiwgIil9XWAsZz1hPT5gWyR7YyhhWzBdKX0sICR7YyhhWzFdKX1dYDsKICBMLnB1c2goIiMgQ2xhdWRlIENvZGUgU3RhdHVzIExpbmUgXHUyMDE0IENvbmZpZ3VyYXRpb24iLCIjIiwiIyBTdHlsZTogbmVyZCB8IHVuaWNvZGUgfCBhc2NpaSIsIiIpOwogIEwucHVzaChgc3R5bGU6ICR7cy5zdHlsZX1gLCIiKTsKICBMLnB1c2goYHNob3dfbGFiZWxzOiAke3Muc2hvd19sYWJlbHN9YCwiIik7CiAgTC5wdXNoKCJwaWxsczoiKTsKICBjb25zdCBzb3J0ZWQ9T2JqZWN0LmVudHJpZXMocy5waWxscykuc29ydCgoYSxiKT0+YVsxXS5vcmRlci1iWzFdLm9yZGVyKTsKICBmb3IoY29uc3Rba2V5LHBdb2Ygc29ydGVkKXsKICAgIEwucHVzaChgICAke2tleX06YCk7TC5wdXNoKGAgICAgZW5hYmxlZDogJHtwLmVuYWJsZWR9YCk7TC5wdXNoKGAgICAgbGFiZWw6ICR7cC5sYWJlbH1gKTtMLnB1c2goYCAgICBvcmRlcjogJHtwLm9yZGVyfWApOwogICAgaWYocC5iYXJfd2lkdGghPW51bGwmJlsiY29udGV4dCIsInJhdGUiXS5pbmNsdWRlcyhrZXkpKUwucHVzaChgICAgIGJhcl93aWR0aDogJHtwLmJhcl93aWR0aH1gKTsKICAgIGlmKGtleT09PSJyYXRlIilMLnB1c2goYCAgICBzaG93X3NldmVuX2RheTogJHtwLnNob3dfc2V2ZW5fZGF5PT09dHJ1ZX1gKTsKICAgIEwucHVzaCgiIik7CiAgfQogIEwucHVzaCgiY29sb3JzOiIpOwogIEwucHVzaChgICBwaWxsX2JnOiAke2Mocy5jb2xvcnMucGlsbF9iZyl9YCk7TC5wdXNoKGAgIGZyYW1lOiAke2Mocy5jb2xvcnMuZnJhbWUpfWApO0wucHVzaChgICBsYWJlbDogJHtjKHMuY29sb3JzLmxhYmVsKX1gKTsKICBMLnB1c2goYCAgZGltOiAke2Mocy5jb2xvcnMuZGltKX1gKTtMLnB1c2goYCAgcGF0aDogJHtjKHMuY29sb3JzLnBhdGgpfWApO0wucHVzaChgICB0aW1lOiAke2Mocy5jb2xvcnMudGltZSl9YCk7CiAgTC5wdXNoKGAgIGRpZmZfYWRkOiAke2Mocy5jb2xvcnMuZGlmZl9hZGQpfWApO0wucHVzaChgICBkaWZmX3NlcDogJHtjKHMuY29sb3JzLmRpZmZfc2VwKX1gKTtMLnB1c2goYCAgZGlmZl9ybTogJHtjKHMuY29sb3JzLmRpZmZfcm0pfWApOwogIEwucHVzaChgICBjb3N0X2dyYWQ6ICR7ZyhzLmNvbG9ycy5jb3N0X2dyYWQpfWAsIiIpOwogIC8vIE1hcCAnZmFsbGJhY2snIGJhY2sgdG8gJ2RlZmF1bHQnIGluIFlBTUwgb3V0cHV0CiAgTC5wdXNoKCIgIG1vZGVsX3RoZW1lczoiKTsKICBmb3IoY29uc3Rbbixncl1vZiBPYmplY3QuZW50cmllcyhzLmNvbG9ycy5tb2RlbF90aGVtZXMpKXsKICAgIGNvbnN0IHlhbWxLZXk9bj09PSJmYWxsYmFjayI/ImRlZmF1bHQiOm47CiAgICBMLnB1c2goYCAgICAke3lhbWxLZXl9OiAke2coZ3IpfWApOwogIH0KICBMLnB1c2goIiIpOwogIEwucHVzaCgiICB0aHJlc2hvbGRzOiIpOwogIHMuY29sb3JzLnRocmVzaG9sZHMuZm9yRWFjaCgodCxpKT0+ewogICAgY29uc3QgaXNMYXN0PWk9PT1zLmNvbG9ycy50aHJlc2hvbGRzLmxlbmd0aC0xOwogICAgTC5wdXNoKGAgICAgLSBiZWxvdzogJHtpc0xhc3Q/OTk5OnQuYmVsb3d9YCk7TC5wdXNoKGAgICAgICBjb2xvcjogJHtjKHQuY29sb3IpfWApOwogIH0pOwogIEwucHVzaCgiIik7CiAgTC5wdXNoKCJmcmFtZToiKTtMLnB1c2goYCAgZW5hYmxlZDogJHtzLmZyYW1lLmVuYWJsZWR9YCk7CiAgTC5wdXNoKGAgIHRvcF9sZWZ0OiAiJHtzLmZyYW1lLnRvcF9sZWZ0fSJgKTtMLnB1c2goYCAgdG9wX3JpZ2h0OiAiJHtzLmZyYW1lLnRvcF9yaWdodH0iYCk7CiAgTC5wdXNoKGAgIGJvdF9sZWZ0OiAiJHtzLmZyYW1lLmJvdF9sZWZ0fSJgKTtMLnB1c2goYCAgYm90X3JpZ2h0OiAiJHtzLmZyYW1lLmJvdF9yaWdodH0iYCk7CiAgTC5wdXNoKGAgIGhvcml6b250YWw6ICIke3MuZnJhbWUuaG9yaXpvbnRhbH0iYCk7TC5wdXNoKGAgIHZlcnRpY2FsOiAiJHtzLmZyYW1lLnZlcnRpY2FsfSJgLCIiKTsKICBMLnB1c2goYHBhdGhfc2VnbWVudHM6ICR7cy5wYXRoX3NlZ21lbnRzfWApOwogIHJldHVybiBMLmpvaW4oIlxuIik7Cn0KCmZ1bmN0aW9uIHNob3dZYW1sKCl7CiAgY29uc3QgeT1nZW5ZYW1sKCk7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInlhbWwtb3V0cHV0IikudGV4dENvbnRlbnQ9eTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgieWFtbC1tb2RhbCIpLmNsYXNzTGlzdC5hZGQoInNob3ciKTsKICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh5KS50aGVuKCgpPT50b2FzdCgiQ29waWVkIHRvIGNsaXBib2FyZCEiKSkuY2F0Y2goKCk9Pnt9KTsKfQpmdW5jdGlvbiBjb3B5WWFtbCgpe25hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGdlbllhbWwoKSkudGhlbigoKT0+dG9hc3QoIkNvcGllZCB0byBjbGlwYm9hcmQhIikpfQpmdW5jdGlvbiBkb3dubG9hZFlhbWwoKXsKICBjb25zdCBhPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoImEiKTthLmhyZWY9VVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbZ2VuWWFtbCgpXSx7dHlwZToidGV4dC95YW1sIn0pKTsKICBhLmRvd25sb2FkPSJzdGF0dXNsaW5lX2NvbmZpZy55bWwiO2EuY2xpY2soKTt0b2FzdCgiRG93bmxvYWRlZCEiKTsKfQpmdW5jdGlvbiBjbG9zZU1vZGFsKCl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInlhbWwtbW9kYWwiKS5jbGFzc0xpc3QucmVtb3ZlKCJzaG93Iil9CmZ1bmN0aW9uIHRvYXN0KG0pe2NvbnN0IHQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInRvYXN0Iik7dC50ZXh0Q29udGVudD1tO3QuY2xhc3NMaXN0LmFkZCgic2hvdyIpO3NldFRpbWVvdXQoKCk9PnQuY2xhc3NMaXN0LnJlbW92ZSgic2hvdyIpLDIwMDApfQpmdW5jdGlvbiByZXNldERlZmF1bHRzKCl7c3RhdGU9SlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShERUZBVUxUUykpO2J1aWxkQWxsKCk7dXBkYXRlKCk7dG9hc3QoIlJlc2V0ISIpfQoKZnVuY3Rpb24gdXBkYXRlKCl7CiAgc3RhdGUuc3R5bGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInN0eWxlIikudmFsdWU7CiAgc3RhdGUuc2hvd19sYWJlbHM9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInNob3dfbGFiZWxzIikuY2hlY2tlZDsKICBzdGF0ZS5mcmFtZS5lbmFibGVkPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJmcmFtZV9lbmFibGVkIikuY2hlY2tlZDsKICBzdGF0ZS5wYXRoX3NlZ21lbnRzPStkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicGF0aF9zZWdtZW50cyIpLnZhbHVlOwogIHJlbmRlclByZXZpZXcoKTsKfQoKZnVuY3Rpb24gYnVpbGRBbGwoKXsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgic3R5bGUiKS52YWx1ZT1zdGF0ZS5zdHlsZTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgic2hvd19sYWJlbHMiKS5jaGVja2VkPXN0YXRlLnNob3dfbGFiZWxzOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJmcmFtZV9lbmFibGVkIikuY2hlY2tlZD1zdGF0ZS5mcmFtZS5lbmFibGVkOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJwYXRoX3NlZ21lbnRzIikudmFsdWU9c3RhdGUucGF0aF9zZWdtZW50czsKICBidWlsZFBpbGxzKCk7YnVpbGRDb2xvcnMoKTtidWlsZFRoZW1lcygpO2J1aWxkVGhyZXNob2xkcygpOwp9CgpidWlsZEFsbCgpO3JlbmRlclByZXZpZXcoKTsKPC9zY3JpcHQ+CjwvYm9keT4KPC9odG1sPgo="; /*<embed:config-editor.html>*/
(function ensureEditor() {
  if (!EDITOR_B64) return;
  try {
    const editorPath = path.join(HOME, ".claude", "config-editor.html");
    if (!fs.existsSync(editorPath)) {
      fs.writeFileSync(editorPath, Buffer.from(EDITOR_B64, "base64").toString("utf-8"), "utf-8");
    }
  } catch {}
})();
