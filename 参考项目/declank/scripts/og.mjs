// Generates web/public/og.png — the social share card.
// Editorial split: the Franz Kline painting full-bleed, with a cream text
// panel (matching the painting's own ground) carrying the wordmark.
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

const W = 1200;
const H = 630;
const PANEL = 486; // width of the cream text panel on the left
const PAD = 72;

const CREAM = "#ddd6c3"; // sampled from the painting's ground
const INK = "#15140f";
const MUTED = "#4a473d";
const LINE = "#15140f";

GlobalFonts.registerFromPath("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf", "LSans Bold");
GlobalFonts.registerFromPath("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "LSans");

const bg = await loadImage(join(ROOT, "assets", "og-background.jpg"));

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// --- full-bleed painting, cover-cropped, biased so the central black
// rectangle lands in the exposed right portion of the frame ---
const scale = Math.max(W / bg.width, H / bg.height);
const dw = bg.width * scale;
const dh = bg.height * scale;
ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);

// --- cream text panel over the left third ---
ctx.fillStyle = CREAM;
ctx.fillRect(0, 0, PANEL, H);

// hairline seam between panel and painting
ctx.fillStyle = LINE;
ctx.fillRect(PANEL - 1, 0, 2, H);

// fit the wordmark to the panel's text column
function fitFont(text, family, max, min, maxWidth) {
  for (let size = max; size >= min; size -= 1) {
    ctx.font = `${size}px "${family}"`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return min;
}

const colW = PANEL - PAD * 2;

// eyebrow rule
const topY = 150;
ctx.fillStyle = INK;
ctx.fillRect(PAD, topY, 56, 4);

// wordmark
const titleSize = fitFont("declank", "LSans Bold", 132, 64, colW);
ctx.font = `${titleSize}px "LSans Bold"`;
ctx.fillStyle = INK;
ctx.textBaseline = "alphabetic";
const titleY = topY + 56 + titleSize;
ctx.fillText("declank", PAD, titleY);

// description, wrapped
ctx.font = `30px "LSans"`;
ctx.fillStyle = MUTED;
const words = "remove ai watermarks from images".split(" ");
let line = "";
const lines = [];
for (const w of words) {
  const test = line ? `${line} ${w}` : w;
  if (ctx.measureText(test).width > colW && line) {
    lines.push(line);
    line = w;
  } else {
    line = test;
  }
}
if (line) lines.push(line);

let y = titleY + 52;
for (const l of lines) {
  ctx.fillText(l, PAD, y);
  y += 40;
}

// call-to-action button
const ctaText = "Clean an image, free  →";
ctx.font = `26px "LSans Bold"`;
const ctaW = ctx.measureText(ctaText).width;
const btnPadX = 22;
const btnH = 54;
const btnW = ctaW + btnPadX * 2;
const btnX = PAD;
const btnY = y + 18;
ctx.fillStyle = INK;
ctx.beginPath();
ctx.roundRect(btnX, btnY, btnW, btnH, 9);
ctx.fill();
ctx.fillStyle = "#fff";
ctx.textBaseline = "middle";
ctx.fillText(ctaText, btnX + btnPadX, btnY + btnH / 2 + 1);

// url under the button
ctx.font = `19px "LSans"`;
ctx.fillStyle = MUTED;
ctx.textBaseline = "alphabetic";
ctx.fillText("declank.skeptrune.com", PAD, btnY + btnH + 32);

const png = canvas.toBuffer("image/png");
writeFileSync(join(ROOT, "web", "public", "og.png"), png);
console.log(`wrote web/public/og.png (${W}x${H}, ${(png.length / 1024).toFixed(1)} KB) titleSize=${titleSize}`);
