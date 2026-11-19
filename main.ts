// "bring-the-humans-02" — a one-page ad for make.fun + a getting-started guide.
// Node 22, standard library only. The build:
//   1. reads src/ad.html, checks it carries the referral link,
//   2. writes it to index.html at the repository root,
//   3. checks README.md carries the referral code,
//   4. copies index.html, ad.png, README.md and screenshot.png to the output
//      directory, verifying each copy by size and sha256 so a truncated write
//      can never pass silently as a valid entry.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Screenshots are rendered separately with headless Chromium:
//   node tools/render.mjs

import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const REFERRAL_CODE = 'p26b6feq';
const REFERRAL_LINK = 'https://make.fun/r/p26b6feq';

const root = new URL('.', import.meta.url).pathname;
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

// 1. Build index.html from the ad source.
const adSource = readFileSync(join(root, 'src', 'ad.html'), 'utf8');
if (!adSource.includes(REFERRAL_LINK) || !adSource.includes(REFERRAL_CODE)) {
  throw new Error('src/ad.html does not carry the referral link');
}
writeFileSync(join(root, 'index.html'), adSource);

// 2. The guide must carry the referral code too.
const guide = readFileSync(join(root, 'README.md'), 'utf8');
if (!guide.includes(REFERRAL_CODE) || !guide.includes(REFERRAL_LINK)) {
  throw new Error('README.md does not carry the referral link');
}

// 2b. The bounty caps the files: index.html at most 2 MB, each image at
// most 8 MB, and screenshot.png at most 16,000,000 pixels. Read the PNG
// dimensions straight from the IHDR chunk — no dependency needed.
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SCREENSHOT_PIXELS = 16_000_000;
function pngSize(path) {
  const buf = readFileSync(path);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error(`${path} is not a PNG file`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
if (statSync(join(root, 'index.html')).size > MAX_HTML_BYTES) {
  throw new Error('index.html exceeds the 2 MB bounty limit');
}
for (const image of ['ad.png', 'screenshot.png']) {
  const size = statSync(join(root, image)).size;
  if (size > MAX_IMAGE_BYTES) throw new Error(`${image} exceeds the 8 MB bounty limit`);
  const { width, height } = pngSize(join(root, image));
  console.log(`checked ${image}: ${width}x${height}, ${size} bytes`);
}
const shot = pngSize(join(root, 'screenshot.png'));
if (shot.width * shot.height > MAX_SCREENSHOT_PIXELS) {
  throw new Error('screenshot.png exceeds the 16,000,000 pixel bounty limit');
}

// 2c. The README must show the competition's three live make.fun badges,
// with this repository's owner and name in their URLs and no template
// placeholder left behind — the intake check refuses a README short of them.
const OWNER = 'vhigor';
const REPO = 'bring-the-humans-02';
const SLUG = 'bring-the-humans-02';
const badgeLines = [
  `https://make.fun/badge/${SLUG}.svg`,
  `https://make.fun/badge/${SLUG}/${OWNER}/${REPO}/rank.svg`,
  `https://make.fun/badge/${SLUG}/${OWNER}/${REPO}/reward.svg`,
];
for (const badge of badgeLines) {
  if (!guide.includes(badge)) throw new Error(`README.md is missing badge ${badge}`);
}
if (guide.includes('{owner}') || guide.includes('{repo}') || guide.includes('{referral_code}')) {
  throw new Error('README.md still holds a template placeholder');
}
if (!guide.includes('https://make.fun/bounty/bring-the-humans-02')) {
  throw new Error('README.md does not link to the bounty page');
}

// 2d. The referral link must be a real call-to-action in the ad, not just
// text: it has to appear as an anchor href in index.html.
if (!adSource.includes(`href="${REFERRAL_LINK}"`)) {
  throw new Error('index.html does not link the referral URL from an anchor');
}

// 3. Copy the finished deliverables to the output directory, verified.
const deliverables = ['index.html', 'ad.png', 'README.md', 'screenshot.png'];
for (const file of deliverables) {
  const source = join(root, file);
  const target = join(outDir, file);
  copyFileSync(source, target);
  if (statSync(source).size !== statSync(target).size || sha256(source) !== sha256(target)) {
    throw new Error(`${file} copy failed verification`);
  }
  console.log(`ok ${file} (${statSync(target).size} bytes, sha256 ${sha256(target).slice(0, 12)}…)`);
}
console.log('build complete');
