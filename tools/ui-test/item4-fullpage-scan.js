/**
 * Item 4 — full-page Trends screenshot + complete intent-chart pixel scan.
 * The viewport screenshot cut the intent chart off; this scans ALL of it.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { PNG } = require('pngjs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. Full-page screenshot
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const p = await b.newPage();
  await p.goto('http://localhost:3000/#/analytics', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);
  const card = await p.evaluate(() => {
    const h = [...document.querySelectorAll('h3')].find((el) => el.textContent.includes('What people are asking for'));
    if (!h) return null;
    const el = h.closest('.md-chart') || h.parentElement;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log('intent card (document coords):', JSON.stringify(card));
  await p.screenshot({ path: 'item4-trends-full.png', fullPage: true });
  console.log('full-page screenshot: item4-trends-full.png');
  await b.close();

  // 2. Scan the ENTIRE intent-card plot area in the full-page image
  const png = PNG.sync.read(fs.readFileSync('item4-trends-full.png'));
  console.log('full-page image:', png.width, 'x', png.height);
  if (!card) { console.error('intent card not found'); process.exit(1); }
  const x0 = card.x + 8, x1 = card.x + card.w - 8;
  const y0 = card.y + 60, y1 = Math.min(png.height - 2, card.y + card.h - 8); // skip title block
  const ramp = [[0x44, 0x40, 0x3C], [0x57, 0x53, 0x4E], [0x78, 0x71, 0x6C], [0xA8, 0xA2, 0x9E], [0xD6, 0xD3, 0xD1]];
  const orange = [0xC2, 0x41, 0x0C], red = [0xB9, 0x1C, 0x1C], blue = [0x1D, 0x4E, 0xED], green = [0x15, 0x80, 0x3D];
  const near = (r, g, bl, c, tol) => Math.abs(r - c[0]) <= tol && Math.abs(g - c[1]) <= tol && Math.abs(bl - c[2]) <= tol;

  let total = 0, statusHue = 0, neutral = 0;
  const statusSamples = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i], g = png.data[i + 1], bl = png.data[i + 2];
      total++;
      const isStatus =
        near(r, g, bl, orange, 45) || near(r, g, bl, red, 45) ||
        near(r, g, bl, blue, 45) || near(r, g, bl, green, 45);
      if (isStatus) { statusHue++; if (statusSamples.length < 6) statusSamples.push([x, y, r, g, bl]); }
      if (ramp.some((c) => near(r, g, bl, c, 14))) neutral++;
    }
  }
  console.log(`scan region: x ${x0}-${x1}, y ${y0}-${y1} (${total} px)`);
  console.log('status-hue pixels (near #C2410C/#B91C1C/#1D4ED8/#15803D, tol 45):', statusHue,
    statusHue === 0 ? '-> ZERO — intent chart uses NO urgency/status colors' : '-> LEAKING ' + JSON.stringify(statusSamples));
  console.log('neutralRamp pixels (tol 14):', neutral, neutral > 500 ? '-> NEUTRAL BARS CONFIRMED' : '-> inspect visually');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
