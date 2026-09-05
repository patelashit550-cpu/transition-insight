/**
 * Remove a small corner watermark by sampling nearby background and inpainting bright pixels.
 * Usage: node scripts/remove-watermark.mjs <input> [output]
 */
import sharp from "sharp";
import fs from "fs";

const input = process.argv[2];
const output = process.argv[3] ?? input;

if (!input || !fs.existsSync(input)) {
  console.error("Usage: node scripts/remove-watermark.mjs <input> [output]");
  process.exit(1);
}

const img = sharp(input);
const meta = await img.metadata();
const { width, height, channels = 3 } = meta;

const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const stride = info.width * info.channels;

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// Bottom-right Gemini star (measured bbox + padding)
const wmLeft = width - 130;
const wmTop = height - 130;
const wmRight = width - 8;
const wmBottom = height - 8;
const pad = 12;
const zLeft = Math.max(0, wmLeft - pad);
const zTop = Math.max(0, wmTop - pad);
const zRight = Math.min(width, wmRight + pad);
const zBottom = Math.min(height, wmBottom + pad);
const zoneW = zRight - zLeft;
const zoneH = zBottom - zTop;

// Sample background from a strip immediately above the watermark zone
const sampleTop = Math.max(0, zTop - 40);
const sampleLeft = zLeft - 20;
const sampleW = zoneW + 40;
const sampleH = 30;

const rs = [];
const gs = [];
const bs = [];
for (let y = sampleTop; y < sampleTop + sampleH; y++) {
  for (let x = sampleLeft; x < sampleLeft + sampleW; x++) {
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const i = y * stride + x * info.channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (lum(r, g, b) < 35) {
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }
}

const fillR = median(rs);
const fillG = median(gs);
const fillB = median(bs);

let replaced = 0;
for (let y = zTop; y < zBottom; y++) {
  for (let x = zLeft; x < zRight; x++) {
    const i = y * stride + x * info.channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = lum(r, g, b);

    // Watermark star + faint glow (threshold tuned for dark bg)
    if (l > 28) {
      const t = Math.min(1, (l - 28) / 45);
      data[i] = Math.round(r * (1 - t) + fillR * t);
      data[i + 1] = Math.round(g * (1 - t) + fillG * t);
      data[i + 2] = Math.round(b * (1 - t) + fillB * t);
      replaced++;
    }
  }
}

// Light blur on the patched zone to hide seams
const patched = await sharp(Buffer.from(data), {
  raw: { width, height, channels: info.channels },
})
  .png()
  .toBuffer();

const blurLeft = Math.max(0, zLeft - 8);
const blurTop = Math.max(0, zTop - 8);
const blurW = Math.min(width - blurLeft, zoneW + 16);
const blurH = Math.min(height - blurTop, zoneH + 16);

const blurredPatch = await sharp(patched)
  .extract({ left: blurLeft, top: blurTop, width: blurW, height: blurH })
  .blur(0.8)
  .toBuffer();

await sharp(patched)
  .composite([{ input: blurredPatch, left: blurLeft, top: blurTop }])
  .png()
  .toFile(output);

console.log(`remove-watermark: ${replaced} pixels inpainted → ${output}`);
