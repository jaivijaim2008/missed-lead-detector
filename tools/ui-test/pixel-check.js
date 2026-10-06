/**
 * Pixel-level proof: sample the actual screenshot files and verify the
 * backdrop is dark (page hidden) and the modal is bright, comparing
 * against a reference screenshot taken with no modal open.
 */
const fs = require('fs');
const { PNG } = require('pngjs');

const BACKDROP_POINTS = [
  [30, 30], [1410, 30], [1410, 870],   // corners (skip 30,870: dev-tools badge)
  [200, 450], [1240, 450], [720, 860], // mid-edges outside the 620px modal
];
// Points that sit on light page areas with NO modal open (right of the
// 232px sidebar) — used to prove the same pixels go dark under the overlay.
const REFERENCE_POINTS = [[1240, 450], [720, 860], [1410, 870]];
const MODAL_POINTS = [[720, 140], [720, 300], [600, 200]];

const lum = (png, x, y) => {
  const idx = (png.width * y + x) << 2;
  return 0.2126 * png.data[idx] + 0.7152 * png.data[idx + 1] + 0.0722 * png.data[idx + 2];
};

function analyze(file, points, label, expect) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const rows = points.map(([x, y]) => ({ x, y, lum: Math.round(lum(png, x, y)) }));
  const ok = rows.every((r) => (expect === 'dark' ? r.lum < 110 : r.lum > 170));
  console.log(`${file} [${label}] -> ${rows.map((r) => `(${r.x},${r.y})=${r.lum}`).join(' ')}  => ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

(async () => {
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const p = await b.newPage();
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));
  await p.screenshot({ path: 'reference-no-modal.png' });
  await b.close();

  let all = true;
  all &= analyze('reference-no-modal.png', REFERENCE_POINTS, 'no modal (reference, light page areas)', 'bright');
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['compose-fixed-today.png', 'compose-fixed-trends.png', 'compose-fixed-leads.png'];
  for (const f of files) {
    all &= analyze(f, BACKDROP_POINTS, 'backdrop', 'dark');
    all &= analyze(f, MODAL_POINTS, 'modal box', 'bright');
  }
  console.log(all ? '\nALL PIXEL CHECKS PASS — background fully hidden, modal intact' : '\nPIXEL CHECKS FAILED');
  process.exit(all ? 0 : 1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
