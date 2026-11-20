// main.ts — "The World in One Image": 19 November 2026 world news front page.
// Renders a 1024x1024 newspaper-style infographic to entry.png.
// Pure Node stdlib: hand-rolled PNG encoder (node:zlib) + hand-rolled 5x7 bitmap font.
// No network, no external assets, fully deterministic: same bytes on every run.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  const crcBuf = Buffer.concat([Buffer.from(type, "ascii"), data]);
  out.writeUInt32BE(crc32(crcBuf), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Raw scanlines: one filter byte (0 = none) + RGB triples per row.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const img = Buffer.alloc(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [248, 244, 233];
const INK: RGB = [26, 26, 26];
const NAVY: RGB = [20, 38, 76];
const RED: RGB = [176, 42, 30];
const GOLD: RGB = [201, 162, 39];
const WHITE: RGB = [255, 255, 255];
const GREY: RGB = [110, 108, 100];
const LIGHT: RGB = [232, 226, 210];

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0];
  img[i + 1] = c[1];
  img[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
  }
}

function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, t, h, c);
}

// Small globe: circle outline, equator + two tropics, one meridian ellipse.
function drawGlobe(cx: number, cy: number, r: number, c: RGB): void {
  for (let deg = 0; deg < 360; deg += 2) {
    const a = (deg * Math.PI) / 180;
    setPx(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), c);
    setPx(Math.round(cx + r * 0.45 * Math.cos(a)), Math.round(cy + r * Math.sin(a)), c);
  }
  for (const dy of [-Math.round(r / 2), 0, Math.round(r / 2)]) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let x = cx - half; x <= cx + half; x++) setPx(x, cy + dy, c);
  }
}

// ---------------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows, 5 bits per row (bit 4 = leftmost pixel).
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x0a, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x10, 0x10, 0x10, 0x0e],
  d: [0x01, 0x01, 0x0d, 0x13, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x08, 0x1e, 0x08, 0x08, 0x08, 0x08],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x16, 0x19, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x00, 0x1e, 0x11, 0x1e, 0x10, 0x10],
  q: [0x00, 0x00, 0x0d, 0x13, 0x0f, 0x01, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1e, 0x08, 0x08, 0x09, 0x06],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0x00, 0x00, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ",": [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  ":": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  ";": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  "-": [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "+": [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  "=": [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  "*": [0x00, 0x04, 0x15, 0x0e, 0x15, 0x04, 0x00],
  '"': [0x0a, 0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "|": [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
};

function drawChar(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if ((g[row] >> (4 - col)) & 1) {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB): void {
  for (let i = 0; i < text.length; i++) {
    drawChar(text[i], x + i * 6 * scale, y, scale, c);
  }
}

function drawTextCentered(text: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(text, cx - Math.floor(textWidth(text, scale) / 2), y, scale, c);
}

// Greedy word wrap to a pixel width; returns lines (never splits a word).
function wrap(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur === "" ? w : cur + " " + w;
    if (textWidth(next, scale) <= maxWidth) {
      cur = next;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(text: string, x: number, y: number, maxWidth: number, scale: number, c: RGB): number {
  const lines = wrap(text, maxWidth, scale);
  const lh = 7 * scale + 4;
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, scale, c));
  return y + lines.length * lh;
}

// ---------------------------------------------------------------- the day's news
// Facts as reported on Thursday 19 November 2026 (UN News, AP, Reuters,
// Dow Jones, OneTurn). Embedded in code: the program runs with no network.

interface Story {
  kicker: string;
  headline: string[]; // pre-split lines, drawn at headline scale
  body: string;
}

const LEAD: Story = {
  kicker: "THE HAGUE  -  JUSTICE",
  headline: ["MYANMAR GUILTY OF", "GENOCIDE, COURT RULES"],
  body: "The International Court of Justice ruled Myanmar committed genocide against the Rohingya in its 2017 military campaign - the first such verdict against a state. Judges voted 9-6. Rohingya refugees in Bangladesh cheered the ruling.",
};

const SUMMIT: Story = {
  kicker: "SHENZHEN  -  SUMMIT",
  headline: ["TRUMP, XI AND PUTIN", "MEET IN SHENZHEN"],
  body: "The three leaders held the first three-way summit and issued a peace declaration that did not mention Ukraine or Iran. They denounced nuclear war.",
};

const MARKETS: Story = {
  kicker: "MARKETS  -  STOCKS",
  headline: ["WALL ST SLIDES AS", "AI FEARS SPREAD"],
  body: "The S&P 500 fell 2.0%, a fifth straight loss; Japan's Nikkei dropped 4.7%. Anthropic's record IPO - $83 a share, $81.3bn raised - failed to calm nerves.",
};

const GRID: Story[] = [
  {
    kicker: "UKRAINE  -  WAR",
    headline: ["UKRAINE HITS CRIMEA", "BRIDGE A THIRD TIME"],
    body: "Kyiv struck the Crimean Bridge a third time in four days, halting rail traffic.",
  },
  {
    kicker: "GAZA  -  CEASEFIRE",
    headline: ["ISRAELI TANKS PUSH", "INTO CENTRAL GAZA"],
    body: "Tanks advanced beyond the ceasefire's Yellow Line near Nuseirat. Aid groups scored the peace plan 4 out of 26.",
  },
  {
    kicker: "GREENLAND  -  DEFENCE",
    headline: ["DENMARK BACKS US", "GREENLAND DEAL 109-0"],
    body: "Parliament ratified the security agreement over Greenland unanimously, 109 votes to none.",
  },
  {
    kicker: "NORTH KOREA  -  NUCLEAR",
    headline: ["IAEA: N. KOREA IS", "EXPANDING URANIUM WORK"],
    body: "Inspectors say Pyongyang expanded uranium enrichment at Yongbyon, the UN nuclear watchdog reported.",
  },
];

const ALSO_TODAY =
  "US Senate rejects Iran war-powers measure 51-48. EU proposes EUR 45bn loan for Ukraine. APEC leaders adopt the Shenzhen Outlook on trade, data and AI.";

// ---------------------------------------------------------------- layout
function drawFrontPage(): void {
  fillRect(0, 0, W, H, PAPER);
  // Outer frame.
  fillRect(0, 0, W, 6, NAVY);
  fillRect(0, H - 6, W, 6, NAVY);
  fillRect(0, 0, 6, H, NAVY);
  fillRect(W - 6, 0, 6, H, NAVY);

  // Masthead.
  fillRect(6, 6, W - 12, 122, NAVY);
  drawGlobe(74, 67, 34, GOLD);
  drawTextCentered("THE WORLD IN ONE IMAGE", 540, 26, 5, WHITE);
  drawTextCentered("THURSDAY, 19 NOVEMBER 2026", 540, 78, 3, GOLD);
  hline(330, 108, 420, GOLD, 2);

  // ---- Lead story (full width).
  let y = 150;
  drawText(LEAD.kicker, 40, y, 2, RED);
  y += 26;
  for (const ln of LEAD.headline) {
    drawText(ln, 40, y, 4, INK);
    y += 36;
  }
  y += 8;
  y = drawPara(LEAD.body, 40, y, 944, 2, INK);
  hline(40, y + 14, 944, INK, 3);

  // ---- Row 2: summit (left) + markets (right).
  const row2 = y + 34;
  vline(512, row2, 176, GREY, 1);
  for (const [story, x0] of [
    [SUMMIT, 40],
    [MARKETS, 544],
  ] as const) {
    let yy = row2;
    drawText(story.kicker, x0, yy, 2, RED);
    yy += 26;
    for (const ln of story.headline) {
      drawText(ln, x0, yy, 3, INK);
      yy += 28;
    }
    yy += 6;
    drawPara(story.body, x0, yy, 440, 2, INK);
  }
  hline(40, row2 + 190, 944, INK, 3);

  // ---- Row 3: 2x2 grid of smaller stories.
  const gridTop = row2 + 210;
  const cellW = 452;
  const cellH = 118;
  const cols = [40, 544];
  const rows = [gridTop, gridTop + cellH + 16];
  GRID.forEach((story, i) => {
    const x0 = cols[i % 2];
    const y0 = rows[Math.floor(i / 2)];
    if (i % 2 === 1) vline(512, y0, cellH, GREY, 1);
    drawText(story.kicker, x0, y0, 2, RED);
    let yy = y0 + 24;
    for (const ln of story.headline) {
      drawText(ln, x0, yy, 2, INK);
      yy += 20;
    }
    yy += 2;
    drawPara(story.body, x0, yy, cellW, 2, INK);
  });
  const gridBottom = gridTop + 2 * cellH + 16;
  hline(40, gridBottom + 8, 944, INK, 3);

  // ---- "Also today" strip.
  const stripY = gridBottom + 26;
  fillRect(6, stripY, W - 12, 74, NAVY);
  drawText("ALSO TODAY", 40, stripY + 12, 2, GOLD);
  drawPara(ALSO_TODAY, 40, stripY + 36, 944, 2, WHITE);

  // ---- Footer.
  const footY = stripY + 74 + 16;
  drawTextCentered("19 NOVEMBER 2026  |  ONE DAY, ONE IMAGE", 512, footY, 2, GREY);
  drawTextCentered("Sources: UN News, AP, Reuters, Dow Jones", 512, footY + 22, 2, GREY);
}

// ---------------------------------------------------------------- entry point
function main(): void {
  drawFrontPage();
  const png = encodePng(W, H, img);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
