#!/usr/bin/env node
/**
 * Renders SVG "screenshots" of the status line for the README and docs.
 *
 * Zero dependencies. The color math (gradients, threshold colors, progress-bar
 * shading, model themes) is copied verbatim from statusline.js so the images
 * match what the terminal actually draws. Pills are drawn as rounded rectangles
 * for a clean, theme-independent look on GitHub (light or dark).
 *
 *   node tools/render-svg.js        # regenerates everything in ../assets
 */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets");

// ── Geometry ────────────────────────────────────────────────
const FS = 15;        // pill text font size
const CW = 9;         // monospace advance at FS=15 (chars are placed by index)
const PILL_H = 26;    // pill height
const PILL_PADX = 9;  // horizontal padding inside a pill
const PILL_GAP = 7;   // gap between pills
const FRAME_PAD = 12; // padding between frame and pills
const CARD_M = 26;    // margin between card edge and frame

// ── Palette (mirrors statusline_config.yml defaults) ────────
const PILL_BG = [58, 62, 72];
const TRACK   = PILL_BG.map(v => Math.min(255, v + 55));
const FRAME   = [120, 120, 138];
const LABEL   = [128, 128, 150];
const DIM     = [168, 162, 172];
const PATHC   = [120, 200, 255];
const TIMEC   = [130, 210, 255];
const DIFF_ADD = [60, 255, 110], DIFF_RM = [255, 75, 75], DIFF_SEP = [120, 140, 135];
const COST_GRAD = [[255, 220, 60], [255, 170, 30]];
const CARD_BG = "#0e1016";
const TITLE_C = "rgb(120,124,140)";

const MODEL_THEMES = {
  opus:    [[175, 100, 255], [255, 120, 230]],
  sonnet:  [[40, 230, 160], [120, 255, 180]],
  haiku:   [[255, 140, 60], [255, 90, 140]],
  fable:   [[64, 224, 208], [255, 198, 88]],
  default: [[200, 200, 230], [240, 240, 255]],
};
const THRESHOLDS = [
  { below: 40, color: [50, 255, 160] },
  { below: 65, color: [200, 255, 50] },
  { below: 80, color: [255, 210, 30] },
  { below: 92, color: [255, 120, 30] },
  { below: 999, color: [255, 50, 50] },
];

// ── Helpers ─────────────────────────────────────────────────
const rnd = n => Math.round(n);
const lerp = (a, b, t) => rnd(a + (b - a) * t);
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function thresholdColor(v) { for (const t of THRESHOLDS) if (v < t.below) return t.color; return THRESHOLDS[THRESHOLDS.length - 1].color; }

// Build arrays of { ch, color, bold }
const solid = (text, color, bold = false) => [...String(text)].map(ch => ({ ch, color, bold }));
function grad(text, a, b, bold = true) {
  const n = Math.max(text.length - 1, 1);
  return [...text].map((ch, i) => ({
    ch, bold,
    color: [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n), lerp(a[2], b[2], i / n)],
  }));
}
function bar(pct, width, color) {
  const filled = Math.min(Math.floor(pct * width / 100), width);
  const f = [0.2, 0.12, 0.08];
  const out = [];
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      const t = i / Math.max(width - 1, 1);
      out.push({ ch: "━", color: color.map((v, j) => Math.min(255, rnd(v * (1 - t * f[j])))), bold: false });
    } else {
      out.push({ ch: "━", color: TRACK, bold: false });
    }
  }
  return out;
}
const cat = (...arrs) => [].concat(...arrs);

// ── Pill content for a scenario ─────────────────────────────
function makePills(o) {
  const pills = [];
  const theme = MODEL_THEMES[o.modelKey] || MODEL_THEMES.default;
  pills.push({ label: "MODEL", chars: grad(o.model, theme[0], theme[1]) });
  if (o.path) pills.push({ label: "PATH", chars: solid(o.path, PATHC, true) });
  if (o.ctxPct != null) {
    const c = thresholdColor(o.ctxPct);
    pills.push({ label: "CONTEXT", chars: cat(solid(o.ctxPct + "%", c, true), solid(" / " + o.ctxSize + "  ", DIM), bar(o.ctxPct, 10, c)) });
  }
  if (o.w5 != null) {
    const c = thresholdColor(o.w5);
    let chars = cat(solid(o.w5 + "%", c, true), solid("  ", DIM), bar(o.w5, 10, c), solid("  " + o.reset5, DIM));
    if (o.seven && o.w7 != null) { const c7 = thresholdColor(o.w7); chars = cat(chars, solid("  ·  ", DIM), solid("7d " + o.w7 + "%", c7, true)); }
    pills.push({ label: "USAGE", chars });
  }
  if (o.add != null) pills.push({ label: "DIFF", chars: cat(solid("+" + o.add, DIFF_ADD, true), solid("  ", DIFF_SEP), solid("−" + o.rm, DIFF_RM, true)) });
  if (o.cost != null) pills.push({ label: "COST", chars: grad("$" + o.cost.toFixed(2), COST_GRAD[0], COST_GRAD[1]) });
  if (o.time != null) pills.push({ label: "TIME", chars: solid(o.time, TIMEC, true) });
  return pills;
}

const pillWidth = p => p.chars.length * CW + PILL_PADX * 2;

// Render one pill (rounded rect + per-char text) at (x, py). Returns svg + width.
function renderPill(p, x, py, withLabel, labelY) {
  const w = pillWidth(p);
  const textY = py + PILL_H / 2 + FS * 0.34;
  let s = `<rect x="${x.toFixed(1)}" y="${py}" width="${w.toFixed(1)}" height="${PILL_H}" rx="7" fill="${rgb(PILL_BG)}"/>`;
  let cx = x + PILL_PADX;
  for (const c of p.chars) {
    s += `<text x="${(cx + CW / 2).toFixed(2)}" y="${textY.toFixed(2)}" font-size="${FS}" text-anchor="middle" fill="${rgb(c.color)}"${c.bold ? ' font-weight="700"' : ''}>${esc(c.ch)}</text>`;
    cx += CW;
  }
  if (withLabel) s += `<text x="${(x + w / 2).toFixed(1)}" y="${labelY}" font-size="10.5" letter-spacing="1" text-anchor="middle" fill="${rgb(LABEL)}">${esc(p.label)}</text>`;
  return { svg: s, w };
}

// Render a full framed status line at (ox, oy). Returns { svg, w, h, pillBoxes }.
function frameGroup(pills, ox, oy, showLabels = true) {
  const pw = pills.map(pillWidth);
  const pillsW = pw.reduce((a, b) => a + b, 0) + PILL_GAP * (pills.length - 1);
  const frameW = pillsW + FRAME_PAD * 2;
  const frameH = FRAME_PAD + PILL_H + (showLabels ? 6 + 13 : 0) + FRAME_PAD;
  const py = oy + FRAME_PAD;
  const labelY = py + PILL_H + 13;
  let s = `<rect x="${ox}" y="${oy}" width="${frameW.toFixed(1)}" height="${frameH}" rx="11" fill="none" stroke="${rgb(FRAME)}" stroke-width="1.5"/>`;
  let x = ox + FRAME_PAD;
  const boxes = [];
  pills.forEach((p, i) => {
    const r = renderPill(p, x, py, showLabels, labelY);
    s += r.svg;
    boxes.push({ x, y: py, w: r.w });
    x += r.w + PILL_GAP;
  });
  return { svg: s, w: frameW, h: frameH, py, boxes };
}

// Width a framed status line will occupy (to center it before building).
function frameWidth(pills) {
  return pills.map(pillWidth).reduce((a, b) => a + b, 0) + PILL_GAP * (pills.length - 1) + FRAME_PAD * 2;
}

// Shared brand defs: prismatic linear gradient + two soft radial glows.
function brandDefs() {
  return `<defs>
  <linearGradient id="prism" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#40e0d0"/><stop offset="0.4" stop-color="#9b8cff"/>
    <stop offset="0.7" stop-color="#ff7be6"/><stop offset="1" stop-color="#ffc658"/>
  </linearGradient>
  <radialGradient id="glowT" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#40e0d0" stop-opacity="0.22"/><stop offset="1" stop-color="#40e0d0" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowM" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ff7be6" stop-opacity="0.20"/><stop offset="1" stop-color="#ff7be6" stop-opacity="0"/>
  </radialGradient>
</defs>`;
}
const SANS = `font-family="-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"`;

function svgDoc(width, height, inner, bg = CARD_BG) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${rnd(width)}" height="${rnd(height)}" viewBox="0 0 ${rnd(width)} ${rnd(height)}" font-family="ui-monospace, SFMono-Regular, 'Cascadia Code', Menlo, Consolas, monospace">
<rect x="0" y="0" width="${rnd(width)}" height="${rnd(height)}" rx="14" fill="${bg}"/>
${inner}
</svg>
`;
}

const write = (name, svg) => { fs.writeFileSync(path.join(OUT, name), svg, "utf-8"); console.log(`  ${name.padEnd(20)} ${svg.length} bytes`); };

// ── 1) Hero — terminal window with a full subscriber status line ──
function buildHero() {
  const pills = makePills({
    model: "Fable 5", modelKey: "fable", path: "…/projects/statusline",
    ctxPct: 42, ctxSize: "1.0M", w5: 23, reset5: "14:30",
    add: 142, rm: 38, cost: 1.85, time: "12m 34s",
  });
  const TB = 42;
  const fg = frameGroup(pills, CARD_M, CARD_M + TB, true);
  const W = fg.w + CARD_M * 2, H = CARD_M + TB + fg.h + CARD_M;
  let chrome = "";
  [["#ff5f56", 0], ["#ffbd2e", 20], ["#27c93f", 40]].forEach(([c, dx]) =>
    chrome += `<circle cx="${CARD_M + 8 + dx}" cy="${CARD_M + 16}" r="6" fill="${c}"/>`);
  chrome += `<text x="${W / 2}" y="${CARD_M + 20}" font-size="12" text-anchor="middle" fill="${TITLE_C}">Claude Code</text>`;
  chrome += `<line x1="${CARD_M}" y1="${CARD_M + TB - 8}" x2="${W - CARD_M}" y2="${CARD_M + TB - 8}" stroke="rgb(38,42,52)" stroke-width="1"/>`;
  write("hero.svg", svgDoc(W, H, chrome + fg.svg));
}

// ── 2) Model gradients — one MODEL pill per model ──
function buildModels() {
  const items = [
    { name: "Claude Opus 4.8", key: "opus", cap: "violet → magenta" },
    { name: "Claude Sonnet 4.6", key: "sonnet", cap: "emerald → mint" },
    { name: "Claude Haiku 4.5", key: "haiku", cap: "amber → rose" },
    { name: "Claude Fable 5", key: "fable", cap: "turquoise → gold" },
  ];
  const pills = items.map(it => ({ label: "", chars: grad(it.name, MODEL_THEMES[it.key][0], MODEL_THEMES[it.key][1]) }));
  const maxPW = Math.max(...pills.map(pillWidth));
  const capX = CARD_M + maxPW + 22;
  const capW = Math.max(...items.map(it => it.cap.length)) * 8 + 10;
  const top = 56, rowH = 42;
  const W = capX + capW + CARD_M, H = top + items.length * rowH + 6;
  let inner = `<text x="${CARD_M}" y="34" font-size="13" font-weight="700" fill="rgb(210,212,222)">Per-model gradient themes</text>`;
  items.forEach((it, i) => {
    const py = top + i * rowH;
    const r = renderPill(pills[i], CARD_M, py, false, 0);
    // center each gradient name within a uniform-width pill box
    inner += `<rect x="${CARD_M}" y="${py}" width="${maxPW.toFixed(1)}" height="${PILL_H}" rx="7" fill="${rgb(PILL_BG)}"/>`;
    const offset = (maxPW - pillWidth(pills[i])) / 2;
    let cx = CARD_M + PILL_PADX + offset;
    const textY = py + PILL_H / 2 + FS * 0.34;
    for (const c of pills[i].chars) { inner += `<text x="${(cx + CW / 2).toFixed(2)}" y="${textY.toFixed(2)}" font-size="${FS}" text-anchor="middle" fill="${rgb(c.color)}" font-weight="700">${esc(c.ch)}</text>`; cx += CW; }
    inner += `<text x="${capX}" y="${textY.toFixed(2)}" font-size="12.5" fill="${rgb(DIM)}">${esc(it.cap)}</text>`;
  });
  write("models.svg", svgDoc(W, H, inner));
}

// ── 3) Context states — CONTEXT pill at four fill levels ──
function buildContextStates() {
  const states = [
    { pct: 28, cap: "plenty of room" },
    { pct: 58, cap: "filling up" },
    { pct: 84, cap: "running low" },
    { pct: 96, cap: "nearly full" },
  ];
  const pills = states.map(s => {
    const c = thresholdColor(s.pct);
    return { label: "", chars: cat(solid(s.pct + "%", c, true), solid(" / 200k  ", DIM), bar(s.pct, 12, c)) };
  });
  const maxPW = Math.max(...pills.map(pillWidth));
  const capX = CARD_M + maxPW + 22;
  const capW = Math.max(...states.map(s => s.cap.length)) * 8 + 10;
  const top = 56, rowH = 42;
  const W = capX + capW + CARD_M, H = top + states.length * rowH + 6;
  let inner = `<text x="${CARD_M}" y="34" font-size="13" font-weight="700" fill="rgb(210,212,222)">Context bar color by fill level</text>`;
  states.forEach((s, i) => {
    const py = top + i * rowH;
    const r = renderPill(pills[i], CARD_M, py, false, 0);
    inner += r.svg;
    const textY = py + PILL_H / 2 + FS * 0.34;
    inner += `<text x="${capX}" y="${textY.toFixed(2)}" font-size="12.5" fill="${rgb(DIM)}">${esc(s.cap)}</text>`;
  });
  write("context-states.svg", svgDoc(W, H, inner));
}

// ── 4) Anatomy — labeled status line + numbered legend ──
function buildAnatomy() {
  const pills = makePills({
    model: "Opus 4.8", modelKey: "opus", path: "…/projects/statusline",
    ctxPct: 42, ctxSize: "1.0M", w5: 23, reset5: "14:30",
    add: 142, rm: 38, cost: 1.85, time: "12m 34s",
  });
  const legend = [
    "MODEL    Active model, tinted by a per-model gradient",
    "PATH     Working directory (last 2 folders)",
    "CONTEXT  Context window used, with a color-coded bar",
    "USAGE    Pro/Max rate-limit % + reset (hidden on API plans)",
    "DIFF     Lines added / removed this session",
    "COST     Estimated cost of the current session",
    "TIME     Session duration",
  ];
  const fg = frameGroup(pills, CARD_M, 60, true);
  const legendW = Math.max(...legend.map(l => l.length)) * 7.4 + 34;
  const W = Math.max(fg.w + CARD_M * 2, legendW + CARD_M * 2);
  const legendTop = 60 + fg.h + 26;
  const lineH = 23;
  const H = legendTop + legend.length * lineH + 6;
  const circ = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];
  let inner = `<text x="${CARD_M}" y="34" font-size="13" font-weight="700" fill="rgb(210,212,222)">Anatomy of the status line</text>`;
  inner += fg.svg;
  // number badges on each pill
  fg.boxes.forEach((b, i) => {
    inner += `<circle cx="${b.x + 2}" cy="${b.y - 1}" r="8" fill="${CARD_BG}" stroke="rgb(150,150,170)" stroke-width="1"/>`;
    inner += `<text x="${b.x + 2}" y="${b.y + 3}" font-size="10" text-anchor="middle" fill="rgb(200,200,215)">${i + 1}</text>`;
  });
  legend.forEach((l, i) => {
    const y = legendTop + i * lineH;
    inner += `<text x="${CARD_M}" y="${y}" font-size="13" fill="rgb(150,150,170)">${esc(circ[i])}</text>`;
    inner += `<text x="${CARD_M + 22}" y="${y}" font-size="13" fill="rgb(198,200,210)" xml:space="preserve">${esc(l)}</text>`;
  });
  write("anatomy.svg", svgDoc(W, H, inner));
}

// Compose the brand lockup + a centered sample status line. Shared by banner & social.
function brandComposition(W, wordmarkY, wordmarkSize, lineOY, modelKey, modelName) {
  let s = brandDefs();
  // soft background glows
  s += `<ellipse cx="${W * 0.16}" cy="${wordmarkY - 30}" rx="${W * 0.34}" ry="220" fill="url(#glowT)"/>`;
  s += `<ellipse cx="${W * 0.86}" cy="${wordmarkY + 10}" rx="${W * 0.34}" ry="220" fill="url(#glowM)"/>`;
  // prism wordmark
  s += `<text x="${W / 2}" y="${wordmarkY}" ${SANS} font-size="${wordmarkSize}" font-weight="800" letter-spacing="-1.5" text-anchor="middle" fill="url(#prism)">Prismatic</text>`;
  // subtitle + tagline
  s += `<text x="${W / 2}" y="${wordmarkY + wordmarkSize * 0.5}" ${SANS} font-size="${Math.round(wordmarkSize * 0.30)}" font-weight="600" letter-spacing="2" text-anchor="middle" fill="rgb(150,152,170)">CLAUDE CODE STATUS LINE</text>`;
  s += `<text x="${W / 2}" y="${wordmarkY + wordmarkSize * 0.5 + 30}" ${SANS} font-size="15" text-anchor="middle" fill="rgb(120,122,140)">Highly customizable · truecolor gradients · zero dependencies</text>`;
  // centered sample status line
  const pills = makePills({
    model: modelName, modelKey, path: "…/projects/statusline",
    ctxPct: 42, ctxSize: "1.0M", w5: 23, reset5: "14:30",
    add: 142, rm: 38, cost: 1.85, time: "12m 34s",
  });
  const fw = frameWidth(pills);
  const ox = (W - fw) / 2;
  s += frameGroup(pills, ox, lineOY, true).svg;
  return s;
}

// ── 5) README hero banner (wide) ──
function buildBanner() {
  const W = 1280, H = 430;
  const inner = brandComposition(W, 150, 76, 250, "fable", "Fable 5");
  write("banner.svg", svgDoc(W, H, inner));
}

// ── 6) Social preview (1280×640, 2:1 — GitHub "Open Graph" image) ──
function buildSocial() {
  const W = 1280, H = 640;
  const inner = brandComposition(W, 250, 92, 390, "opus", "Opus 4.8");
  write("social-preview.svg", svgDoc(W, H, inner));
}

function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  console.log("Rendering SVG assets →", OUT);
  buildBanner();
  buildSocial();
  buildHero();
  buildModels();
  buildContextStates();
  buildAnatomy();
  console.log("Done.");
}

main();
