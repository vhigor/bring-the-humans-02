// Render the ad page and the guide to PNGs with headless Chromium.
// Run from ~/workspace/makefun so `playwright` resolves from its node_modules:
//   node bring-the-humans-02-entry/tools/render.mjs
//   - ad.png: the ad page (src/ad.html), 1200px wide, full page
//   - screenshot.png: README.md rendered GitHub-style, 1280px wide, full page
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal markdown -> HTML for the constructs README.md uses:
// headings, bold, inline code, links, images, bullet/numbered lists,
// fenced code, horizontal rules, paragraphs. Escapes HTML first.
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s) {
  // Protect code spans from later replacements.
  const codes = [];
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  // Bare URLs become links (skip URLs that belong to a markdown link/image,
  // which are preceded by `](`; and stop before a bold marker `**`).
  t = t.replace(/(?<!\]\()https?:\/\/[^\s<)*]+/g, (u) => `<a href="${u}">${u}</a>`);
  // Images, then links (an image inside a link becomes <img> inside <a>).
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${codes[+n]}</code>`);
}
function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      let code = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code += lines[i] + '\n'; i++; }
      html += `<pre><code class="${lang}">${esc(code)}</code></pre>`;
      i++;
      continue;
    }
    if (line.startsWith('# ')) { html += `<h1>${inline(line.slice(2))}</h1>`; i++; continue; }
    if (line.startsWith('## ')) { html += `<h2>${inline(line.slice(3))}</h2>`; i++; continue; }
    if (line.startsWith('### ')) { html += `<h3>${inline(line.slice(4))}</h3>`; i++; continue; }
    if (line.trim() === '---') { html += '<hr>'; i++; continue; }
    if (line.trim().startsWith('<sub>')) {
      html += `<p><small>${inline(line.replace(/<\/?sub>/g, ''))}</small></p>`;
      i++;
      continue;
    }
    if (/^(\s*[-*]|\s*\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\.\s/.test(line);
      html += ordered ? '<ol>' : '<ul>';
      while (i < lines.length && /^(\s*[-*]|\s*\d+\.)\s/.test(lines[i])) {
        // Item text plus any indented continuation lines that follow it.
        let item = lines[i].replace(/^(\s*[-*]|\s*\d+\.)\s/, '');
        i++;
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^(\s*[-*]|\s*\d+\.)\s/.test(lines[i])) {
          item += ' ' + lines[i].trim();
          i++;
        }
        html += `<li>${inline(item)}</li>`;
      }
      html += ordered ? '</ol>' : '</ul>';
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    let para = line;
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('```') && lines[i].trim() !== '---' && !/^(\s*[-*]|\s*\d+\.)\s/.test(lines[i])) {
      para += ' ' + lines[i];
      i++;
    }
    html += `<p>${inline(para)}</p>`;
  }
  return html;
}

const guideMd = readFileSync(join(root, 'README.md'), 'utf8');
let guideBody = mdToHtml(guideMd);
// Headless Chromium in this sandbox has no internet, so the live make.fun
// badges would render as broken images. Fetch the exact badge SVGs (they
// are public) and inline them as data URIs — for the screenshot only.
// README.md itself keeps the live badge URLs, which is what the checks read.
for (const m of guideBody.matchAll(/src="(https:\/\/make\.fun\/badge\/[^"]+\.svg)"/g)) {
  try {
    const svg = execFileSync('curl', ['-sL', '--max-time', '15', m[1]], { encoding: 'buffer' });
    if (svg.length > 0 && svg.includes('<svg')) {
      guideBody = guideBody.split(`src="${m[1]}"`).join(
        `src="data:image/svg+xml;base64,${svg.toString('base64')}"`);
      console.log('inlined badge', m[1]);
    }
  } catch { /* leave the remote URL; the screenshot degrades gracefully */ }
}
const guideHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body { margin: 0; background: #f6f8fa; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
.markdown-body { box-sizing: border-box; max-width: 980px; margin: 24px auto; background: #fff; border: 1px solid #d0d7de; border-radius: 6px; padding: 32px 40px; color: #1f2328; font-size: 16px; line-height: 1.6; }
.markdown-body h1 { font-size: 28px; border-bottom: 1px solid #d0d7de; padding-bottom: 8px; margin: 0 0 16px; }
.markdown-body h2 { font-size: 22px; border-bottom: 1px solid #d0d7de; padding-bottom: 6px; margin: 24px 0 12px; }
.markdown-body a { color: #0969da; text-decoration: none; }
.markdown-body code { background: #eff1f3; border-radius: 6px; padding: 2px 6px; font-size: 14px; }
.markdown-body pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow: auto; }
.markdown-body pre code { background: none; padding: 0; }
.markdown-body img { max-width: 100%; }
.markdown-body hr { border: none; border-top: 1px solid #d0d7de; margin: 24px 0; }
.markdown-body ul, .markdown-body ol { padding-left: 28px; }
.markdown-body li { margin: 4px 0; }
</style></head><body><div class="markdown-body">${guideBody}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto('file://' + join(root, 'src', 'ad.html'));
await page.waitForTimeout(400);
await page.screenshot({ path: join(root, 'ad.png'), fullPage: true });
console.log('rendered ad.png');

const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page2.setContent(guideHtml);
await page2.waitForLoadState('networkidle').catch(() => {});
// The README's live make.fun badges are remote SVGs — wait until they have
// actually loaded, otherwise the screenshot shows broken-image icons.
await page2.evaluate(() => Promise.all(
  [...document.images].map((img) => img.complete
    ? Promise.resolve()
    : new Promise((res) => { img.addEventListener('load', res); img.addEventListener('error', res); })),
)).catch(() => {});
await page2.waitForTimeout(600);
await page2.screenshot({ path: join(root, 'screenshot.png'), fullPage: true });
console.log('rendered screenshot.png');
await browser.close();
