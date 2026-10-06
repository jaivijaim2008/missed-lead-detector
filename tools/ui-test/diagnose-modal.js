/**
 * Diagnostic: inspect computed styles + geometry of the Compose modal
 * as actually rendered, from two different pages (Today and Trends).
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openComposeAndMeasure(page, label) {
  console.log(`\n===== ${label} =====`);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) => el.textContent.trim().includes('Compose'));
    if (b) b.click();
  });
  await page.waitForSelector('.md-modal', { timeout: 10000 });
  await sleep(400);

  const info = await page.evaluate(() => {
    const overlay = document.querySelector('.md-overlay');
    const modal = document.querySelector('.md-modal');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const rect = (el) => (el ? el.getBoundingClientRect().toJSON() : null);

    const ov = cs(overlay);
    const md = cs(modal);

    // Field geometry: label vs input overlap check
    const fields = [...modal.querySelectorAll('.md-field')].map((f) => {
      const lab = f.querySelector('label');
      const inp = f.querySelector('.md-input');
      const fcs = cs(f);
      return {
        fieldDisplay: fcs.display,
        fieldPosition: fcs.position,
        flexDirection: fcs.flexDirection,
        gap: fcs.gap,
        labelRect: rect(lab),
        inputRect: rect(inp),
        labelPosition: cs(lab).position,
        inputPosition: cs(inp).position,
        labelMargin: cs(lab).margin,
        inputMargin: cs(inp).margin,
      };
    });

    // What's above the overlay in paint order?
    const topEl = document.elementFromPoint(720, 450);

    return {
      overlayFound: !!overlay,
      overlay: ov && {
        position: ov.position,
        zIndex: ov.zIndex,
        background: ov.background.slice(0, 60),
        top: ov.top, left: ov.left, right: ov.right, bottom: ov.bottom,
        inset: ov.inset,
        display: ov.display,
      },
      overlayRect: rect(overlay),
      modal: md && { position: md.position, zIndex: md.zIndex, display: md.display },
      ancestorWithTransform: (() => {
        let el = overlay ? overlay.parentElement : null;
        while (el) {
          const c = getComputedStyle(el);
          if (c.transform !== 'none' || c.filter !== 'none' || c.willChange.includes('transform') || c.perspective !== 'none') {
            return `${el.tagName}.${el.className}` + ` [transform=${c.transform.slice(0, 40)}, filter=${c.filter}, perspective=${c.perspective}, willChange=${c.willChange}]`;
          }
          el = el.parentElement;
        }
        return null;
      })(),
      elementAtCenter: topEl ? `${topEl.tagName}.${typeof topEl.className === 'string' ? topEl.className.slice(0, 60) : ''}` : null,
      fields,
      bodyOverflow: getComputedStyle(document.body).overflow,
      fieldErrCount: modal.querySelectorAll('.md-field-err').length,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: `diag-${label.toLowerCase().replace(/\s+/g, '-')}.png` });

  // close modal for next iteration
  await page.evaluate(() => {
    const c = document.querySelector('.md-modal-close');
    if (c) c.click();
  });
  await sleep(300);
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

  await openComposeAndMeasure(page, 'Today');

  // Navigate to Trends
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.md-nav-item')];
    const trends = items.find((el) => el.textContent.trim().includes('Trends'));
    if (trends) trends.click();
  });
  await sleep(1500);
  await openComposeAndMeasure(page, 'Trends');

  await browser.close();
})().catch((e) => { console.error('DIAG FAILED:', e.message); process.exit(1); });
