import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public/images/weblogo.jpeg');
const out = join(root, 'public/icons');

const BG = '#0a0a0a';

const standard = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'icon-180x180.png' },
];

const maskable = [
  { size: 192, name: 'icon-maskable-192x192.png' },
  { size: 512, name: 'icon-maskable-512x512.png' },
];

await mkdir(out, { recursive: true });

const circleMask = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );

for (const { size, name } of standard) {
  await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: circleMask(size), blend: 'dest-in' }])
    .png()
    .toFile(join(out, name));
  console.log(`✓ ${name}`);
}

for (const { size, name } of maskable) {
  const inner = Math.round(size * 0.8); // 10% safe-zone on each side
  const padding = Math.round((size - inner) / 2);

  await sharp(src)
    .resize(inner, inner, { fit: 'cover' })
    .composite([{ input: circleMask(inner), blend: 'dest-in' }])
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: BG })
    .png()
    .toFile(join(out, name));
  console.log(`✓ ${name} (maskable)`);
}

console.log('\nDone — icons written to public/icons/');
