// Render a markdown file to a styled PDF via headless Edge (print-to-PDF).
// Usage: node eval/build_pdf.mjs <input.md> <output.pdf> [mermaid:true|false]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [, , inArg, outArg, mermaidArg] = process.argv;
const mdPath = resolve(inArg);
const pdfPath = resolve(outArg);
const useMermaid = mermaidArg !== 'false';

const md = readFileSync(mdPath, 'utf8');

// Resolve local screenshot paths (relative to the md file's folder) to file:// URLs
const mdDir = pathToFileURL(mdPath.replace(/[/\\][^/\\]+$/, '/')).href;
const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
${useMermaid ? '<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>' : ''}
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', 'Nirmala UI', serif;
    color: #1c2430; margin: 0; padding: 0; font-size: 10.5pt; line-height: 1.62;
  }
  .page-pad { padding: 18mm 16mm; }
  h1, h2, h3, h4 { font-family: 'Segoe UI', 'Nirmala UI', Arial, sans-serif; color: #0e2a3a; line-height: 1.25; }
  h1 { font-size: 21pt; border-bottom: 3px solid #1a3a42; padding-bottom: 8px; margin: 0 0 14px; page-break-before: always; }
  h1:first-of-type { page-break-before: avoid; }
  h2 { font-size: 15pt; border-bottom: 1.5px solid #d1c9bb; padding-bottom: 5px; margin: 22px 0 10px; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 18px 0 8px; color: #1a3a42; page-break-after: avoid; }
  p { margin: 7px 0; }
  blockquote {
    margin: 10px 0; padding: 9px 14px; border-left: 4px solid #b8860b;
    background: #fdf6e3; border-radius: 0 6px 6px 0; page-break-inside: avoid;
  }
  blockquote p { margin: 4px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 9.5pt; page-break-inside: avoid; }
  th { background: #1a3a42; color: #fff; text-align: left; padding: 7px 9px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; }
  td { border: 1px solid #d9d2c4; padding: 6px 9px; vertical-align: top; }
  tr:nth-child(even) td { background: #f6f3ec; }
  code { background: #f0ece4; padding: 1px 5px; border-radius: 4px; font-size: 9pt; font-family: Consolas, monospace; }
  ul, ol { margin: 7px 0; padding-left: 22px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #d1c9bb; margin: 18px 0; }
  strong { color: #0e2a3a; }
  .cover {
    page-break-after: always; text-align: center; padding-top: 70mm;
  }
  .cover h1 { border: none; font-size: 30pt; page-break-before: avoid; margin-bottom: 8px; }
  .cover .sub { font-size: 13pt; color: #444; }
  .cover .meta { margin-top: 30mm; font-size: 10.5pt; color: #666; }
  .cover .kicker { font-family: 'Segoe UI', Arial, sans-serif; letter-spacing: 0.28em; font-size: 9pt; color: #b8860b; font-weight: 700; margin-bottom: 10mm; }
  img.shot { width: 100%; border: 1px solid #d1c9bb; border-radius: 6px; margin: 8px 0; }
  .shot-caption { font-size: 8.5pt; color: #666; text-align: center; margin: 2px 0 12px; font-family: 'Segoe UI', Arial, sans-serif; }
  .mermaid { display: flex; justify-content: center; margin: 14px 0; }
  .mermaid svg { max-width: 100% !important; height: auto !important; }
  footer.note { font-size: 8.5pt; color: #888; border-top: 1px solid #ddd; padding-top: 6px; margin-top: 20px; }
</style>
</head><body>
<div class="page-pad" id="content"></div>
<script>
  const md = ${JSON.stringify(md)};
  // Split at the first h2-like marker so we can add a cover page
  const lines = md.split('\\n');
  let cover = null;
  if (lines[0]?.startsWith('# ')) {
    const title = lines[0].replace(/^#\\s+/, '');
    // find end of the header block (first ---)
    const sepIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    cover = { title, rest: lines.slice(sepIdx + 1).join('\\n') };
  }
  const body = cover ? cover.rest : md;
  document.getElementById('content').innerHTML =
    (cover ? '<div class="cover"><div class="kicker">SMART INDIA HACKATHON 2026 · TEAM HEXAFORGE</div><h1>' + cover.title + '</h1><div class="meta">PS 26094 · Confidential — for team use only</div></div>' : '')
    + marked.parse(body);
  // Rewrite relative image links to file:// URLs
  document.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    if (src && !/^(https?:|data:|file:)/.test(src)) {
      img.src = ${JSON.stringify(mdDir)} + src.replace(/^\\.\\//, '');
      img.className = 'shot';
    }
  });
  // Convert mermaid code fences into mermaid divs
  document.querySelectorAll('pre > code.language-mermaid, pre > code[class*="language-mermaid"]').forEach((code) => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
  });
</script>
${useMermaid ? `<script>mermaid.initialize({ startOnLoad: true, theme: 'neutral', flowchart: { htmlLabels: true } });</script>` : ''}
</body></html>`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
// Write the HTML to a temp file beside the markdown so file:// images are same-origin loadable.
// (setContent pages run at about:blank origin, which Chromium blocks from reading file:// images.)
const { writeFileSync, unlinkSync } = await import('node:fs');
const tempHtml = mdPath.replace(/\.md$/i, '.__pdf_temp.html');
writeFileSync(tempHtml, html, 'utf8');
await page.goto(pathToFileURL(tempHtml).href, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => [...document.images].every((i) => i.complete),
  { timeout: 30000 },
).catch(() => {});
const imgs = await page.evaluate(() => {
  const all = [...document.images];
  return { total: all.length, broken: all.filter((i) => !i.naturalWidth).length };
});
console.log(`[pdf] images: ${imgs.total} total, ${imgs.broken} broken`);
// Let mermaid finish rendering
if (useMermaid) await page.waitForTimeout(2500);
const count = await page.evaluate(() => document.querySelectorAll('.mermaid svg').length);
console.log(`[pdf] mermaid diagrams rendered: ${count}`);
await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '16mm', left: '13mm', right: '13mm' } });
await browser.close();
try { unlinkSync(tempHtml); } catch { /* ignore */ }
console.log(`[pdf] wrote ${pdfPath}`);
