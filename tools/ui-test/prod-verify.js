/**
 * Production re-verification of the Compose modal:
 *  - confirms the Next.js dev-mode badge is gone in production
 *  - probes ALL backdrop points from three pages (including bottom-left)
 *  - screenshots Today / Trends / Leads
 *  - sanity-checks the self-hosted fonts actually apply
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(page, label) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) => el.textContent.trim().includes('Compose'));
    if (b) b.click();
  });
  await page.waitForSelector('.md-modal', { timeout: 10000 });
  await sleep(500);

  const result = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 300)); // let the fade-in finish
    const pts = [
      [30, 30], [1410, 30], [30, 870], [1410, 870],
      [200, 450], [1240, 450], [720, 860],
    ];
    const points = pts.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return { x, y, covered: !!el?.closest('.md-overlay'), painted: el ? el.tagName + '.' + String(el.className).slice(0, 30) : 'none' };
    });
    const overlay = getComputedStyle(document.querySelector('.md-overlay'));
    const h = document.querySelector('.md-pagehead h1');
    const headStyle = h ? getComputedStyle(h) : null;
    return {
      points,
      overlay: { zIndex: overlay.zIndex, background: overlay.background.slice(0, 40), position: overlay.position },
      devBadgeGone: !document.querySelector('nextjs-portal'),
      fontSample: headStyle ? { fontFamily: headStyle.fontFamily.slice(0, 60), loaded: document.fonts.check('600 26px Fraunces') } : null,
    };
  });

  const allCovered = result.points.every((p) => p.covered);
  console.log(`[${label}] overlay: z=${result.overlay.zIndex} ${result.overlay.background}`);
  console.log(`[${label}] backdrop coverage: ${result.points.filter((p) => p.covered).length}/${result.points.length} -> ${allCovered ? 'FULLY HIDDEN (incl. old dev-badge corner)' : 'GAPS: ' + JSON.stringify(result.points.filter((p) => !p.covered))}`);
  console.log(`[${label}] dev badge gone: ${result.devBadgeGone}`);
  console.log(`[${label}] font check: ${JSON.stringify(result.fontSample)}`);

  await page.type('#compose-to', 'jaivijai188@gmail.com');
  await page.type('#compose-subject', 'Production render check');
  await page.screenshot({ path: `prod-compose-${label}.png` });
  console.log(`[${label}] screenshot: prod-compose-${label}.png`);

  await page.evaluate(() => {
    const c = document.querySelector('.md-modal-close');
    if (c) c.click();
  });
  await sleep(350);
  return allCovered;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1200);

  let all = true;
  all &= await probe(page, 'today');

  for (const nav of ['Trends', 'Leads']) {
    await page.evaluate((n) => {
      const items = [...document.querySelectorAll('.md-nav-item')];
      const target = items.find((el) => el.textContent.trim().includes(n));
      if (target) target.click();
    }, nav);
    await sleep(1400);
    all &= await probe(page, nav.toLowerCase());
  }

  await browser.close();
  console.log(all ? '\nPRODUCTION VERIFICATION PASSED' : '\nPRODUCTION VERIFICATION FAILED');
  process.exit(all ? 0 : 1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
