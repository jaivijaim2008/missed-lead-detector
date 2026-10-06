/**
 * Item 4 — visual evidence:
 *  - screenshots Trends (full page), Automations, History
 *  - reports the bounding box of the "What people are asking for" chart
 *  - pixel-scans the Trends shot: darker green #166534 present in the
 *    volume-chart band (the dashed follow-up line), and zero status-hue
 *    pixels (orange/red/blue/green) inside the intent-chart bounds
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { PNG } = require('pngjs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function scan(png, x0, y0, x1, y1, want) {
  let count = 0;
  for (let y = Math.max(0, y0); y < Math.min(png.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(png.width, x1); x++) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (want === 'greenLine') {
        if (Math.abs(r - 0x16) < 26 && Math.abs(g - 0x65) < 26 && Math.abs(b - 0x34) < 26) count++;
      } else if (want === 'urgencyOrange') {
        if (r > 150 && g > 40 && g < 130 && b < 80) count++;
      } else if (want === 'red') {
        if (r > 140 && g < 80 && b < 80) count++;
      } else if (want === 'blue') {
        if (b > 140 && r < 100 && g < 130) count++;
      } else if (want === 'green') {
        if (g > 110 && r < 100 && b < 110) count++;
      } else if (want === 'neutralDark') {
        if (r >= 0x40 && r <= 0x80 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12) count++;
      }
    }
  }
  return count;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();

  // ── Trends ──
  await page.goto('http://localhost:3000/#/analytics', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);

  const boxes = await page.evaluate(() => {
    const findCard = (title) => {
      const h = [...document.querySelectorAll('h3, h2, .md-chart h3')].find((el) => el.textContent.includes(title));
      if (!h) return null;
      const card = h.closest('div[class*="md-chart"], .md-chart, div');
      const r = (card || h).getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      volume: findCard('What your inbox looked like'),
      intent: findCard('What people are asking for'),
    };
  });
  console.log('Chart bounds:', JSON.stringify(boxes));
  await page.screenshot({ path: 'item4-trends.png' });
  console.log('screenshot: item4-trends.png');

  // ── Automations ──
  await page.evaluate(() => { window.location.hash = '#/automations'; });
  await sleep(2000);
  await page.screenshot({ path: 'item4-automations.png' });
  console.log('screenshot: item4-automations.png');

  // ── History ──
  await page.evaluate(() => { window.location.hash = '#/activity'; });
  await sleep(2000);
  await page.screenshot({ path: 'item4-history.png' });
  console.log('screenshot: item4-history.png');

  await browser.close();

  // ── Pixel scans on the Trends shot ──
  const png = PNG.sync.read(fs.readFileSync('item4-trends.png'));
  const v = boxes.volume, it = boxes.intent;
  const vBand = v ? { x0: v.x, y0: v.y, x1: v.x + v.w, y1: v.y + v.h } : { x0: 0, y0: 300, x1: 1440, y1: 620 };
  const iBand = it ? { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h } : { x0: 0, y0: 620, x1: 720, y1: 900 };

  const evidence = {
    greenLineInVolume: scan(png, vBand.x0, vBand.y0, vBand.x1, vBand.y1, 'greenLine'),
    intentOrange: scan(png, iBand.x0, iBand.y0, iBand.x1, iBand.y1, 'urgencyOrange'),
    intentRed: scan(png, iBand.x0, iBand.y0, iBand.x1, iBand.y1, 'red'),
    intentBlue: scan(png, iBand.x0, iBand.y0, iBand.x1, iBand.y1, 'blue'),
    intentGreen: scan(png, iBand.x0, iBand.y0, iBand.x1, iBand.y1, 'green'),
    intentNeutral: scan(png, iBand.x0, iBand.y0, iBand.x1, iBand.y1, 'neutralDark'),
  };
  console.log('\nPIXEL EVIDENCE (item4-trends.png):');
  console.log('  #166534 dashed-line pixels in volume chart band:', evidence.greenLineInVolume, evidence.greenLineInVolume > 30 ? '-> GREEN LINE VISIBLE' : '-> NOT FOUND');
  const urgency = evidence.intentOrange + evidence.intentRed + evidence.intentBlue + evidence.intentGreen;
  console.log('  status-hue pixels in intent chart: orange=' + evidence.intentOrange, 'red=' + evidence.intentRed, 'blue=' + evidence.intentBlue, 'green=' + evidence.intentGreen, '-> total ' + urgency, urgency === 0 ? '-> SEPARATE PALETTE (no status hues)' : '-> STATUS HUES LEAKING');
  console.log('  neutral-ramp pixels in intent chart:', evidence.intentNeutral, evidence.intentNeutral > 200 ? '-> NEUTRAL BARS PRESENT' : '-> check');

  fs.writeFileSync('item4-pixel-evidence.json', JSON.stringify({ boxes, evidence }, null, 2));
  console.log('evidence saved: item4-pixel-evidence.json');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
