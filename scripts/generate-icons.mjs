/**
 * Generates the PWA icons in public/icons/ from the favicon's database-
 * cylinder design, using only node:zlib (no image libraries). Re-run with
 * `node scripts/generate-icons.mjs` whenever the brand colors change —
 * colors below mirror --gb-orange-strong / gruvbox bg0 in theme.css.
 *
 * Outputs:
 *   icon-192.png / icon-512.png       — purpose "any" (rounded tile, transparent corners)
 *   maskable-192.png / maskable-512.png — purpose "maskable" (full-bleed bg, art in safe zone)
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORANGE = [0xd6, 0x5d, 0x0e]; // gruvbox neutral orange
const CREAM = [0xfb, 0xf1, 0xc7]; // gruvbox light bg0

// ── Minimal PNG encoder (RGBA, 8-bit) ───────────────────────────────────
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // scanlines, each prefixed with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon artwork, in the favicon's 32-unit coordinate space ─────────────
// Coverage functions return true when a (design-space) point is inside.
const STROKE = 1.0; // half of the favicon's 2-unit stroke width

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  const qx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const qy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return x >= x0 && x <= x1 && y >= y0 && y <= y1 && qx * qx + qy * qy <= r * r;
}

/** Approximate distance to an ellipse ring centered (cx,cy). */
function onEllipseRing(x, y, cx, cy, rx, ry, halfOnly) {
  if (halfOnly && y < cy) return false;
  // Gradient-normalized implicit distance: |f-1| / |∇f| keeps the stroke
  // width uniform all the way around the ellipse.
  const f = Math.hypot((x - cx) / rx, (y - cy) / ry);
  if (f === 0) return false;
  const grad = Math.hypot((x - cx) / (rx * rx), (y - cy) / (ry * ry)) / f;
  return grad > 0 && Math.abs(f - 1) / grad <= STROKE;
}

function onCylinder(x, y) {
  return (
    onEllipseRing(x, y, 16, 10, 8, 3.5, false) || // top rim
    onEllipseRing(x, y, 16, 16, 8, 3.5, true) || // middle band
    onEllipseRing(x, y, 16, 22, 8, 3.5, true) || // bottom
    (Math.abs(x - 8) <= STROKE && y >= 10 && y <= 22) || // left side
    (Math.abs(x - 24) <= STROKE && y >= 10 && y <= 22) // right side
  );
}

/**
 * Render one icon. maskable: full-bleed background with the artwork scaled
 * into the central 80% safe zone; otherwise a rounded tile with transparent
 * corners.
 */
function renderIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // supersamples per axis
  // Design-space transform: contentScale shrinks the 32-unit artwork.
  const contentScale = maskable ? 0.72 : 1;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0;
      let fgHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // pixel -> 32-unit design space
          const u = ((px + (sx + 0.5) / SS) / size) * 32;
          const v = ((py + (sy + 0.5) / SS) / size) * 32;
          const inBg = maskable ? true : inRoundedRect(u, v, 2, 2, 30, 30, 7);
          if (!inBg) continue;
          bgHits++;
          // artwork coordinates (centered scale for the safe zone)
          const ax = 16 + (u - 16) / contentScale;
          const ay = 16 + (v - 16) / contentScale;
          if (onCylinder(ax, ay)) fgHits++;
        }
      }
      const total = SS * SS;
      const alpha = bgHits / total;
      const fg = bgHits > 0 ? fgHits / bgHits : 0;
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(ORANGE[0] + (CREAM[0] - ORANGE[0]) * fg);
      rgba[i + 1] = Math.round(ORANGE[1] + (CREAM[1] - ORANGE[1]) * fg);
      rgba[i + 2] = Math.round(ORANGE[2] + (CREAM[2] - ORANGE[2]) * fg);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, rgba);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), renderIcon(size, false));
  writeFileSync(join(outDir, `maskable-${size}.png`), renderIcon(size, true));
  console.log(`icons: ${size}px written`);
}
