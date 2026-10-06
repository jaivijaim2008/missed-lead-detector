/** Identify the element that paints over the overlay at (30, 870). */
const puppeteer = require('puppeteer-core');

(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const p = await b.newPage();
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));
  await p.evaluate(() => {
    [...document.querySelectorAll('button')].find((el) => el.textContent.includes('Compose')).click();
  });
  await p.waitForSelector('.md-modal');
  await new Promise((r) => setTimeout(r, 400));
  const el = await p.evaluate(() => {
    const e = document.elementFromPoint(30, 870);
    if (!e) return null;
    return {
      tag: e.tagName,
      isCustomElement: e.tagName.includes('-'),
      hasShadowRoot: !!e.shadowRoot,
      className: typeof e.className === 'string' ? e.className : '(non-string className)',
      id: e.id || '(none)',
    };
  });
  console.log('Element at (30,870):', JSON.stringify(el, null, 2));
  await b.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
