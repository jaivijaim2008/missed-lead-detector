/**
 * Contrast audit for the Compose modal + top bar (regression test for the
 * white-on-white bug): computes WCAG contrast ratios of every text element
 * from the styles actually applied in the browser, and screenshots the
 * fixed modal from two pages.
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lum = ({ r, g, b }) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const parse = (s) => {
  const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
};

// Effective background = nearest ancestor with a non-transparent background
const bgOf = (el) => {
  let n = el;
  while (n && n !== document.documentElement) {
    const bg = parse(getComputedStyle(n).backgroundColor);
    if (bg && bg.a > 0.9) return bg;
    n = n.parentElement;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
};

const ratio = (fg, bg) => {
  const l1 = lum(fg), l2 = lum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

async function audit(page, label) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) => el.textContent.trim().includes('Compose'));
    if (b) b.click();
  });
  await page.waitForSelector('.md-modal', { timeout: 10000 });
  await sleep(450);

  const report = await page.evaluate(() => {
    const lum2 = ({ r, g, b }) => {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse2 = (s) => {
      const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
    };
    const bgOf2 = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const bg = parse2(getComputedStyle(n).backgroundColor);
        if (bg && bg.a > 0.9) return bg;
        n = n.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const out = [];
    const selectors = [
      '.md-modal-head h2', '.md-modal-close',
      '.md-field label', '#compose-to', '#compose-subject', '#compose-body',
      '.md-modal-foot .md-btn-quiet', '.md-modal-foot .md-btn-primary',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) { out.push({ sel, missing: true }); continue; }
      const cs = getComputedStyle(el);
      const fg = parse2(cs.color);
      const bg = bgOf2(el);
      const r = fg && bg ? (Math.max(lum2(fg), lum2(bg)) + 0.05) / (Math.min(lum2(fg), lum2(bg)) + 0.05) : null;
      out.push({
        sel,
        color: cs.color,
        bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
        ratio: r ? +r.toFixed(2) : null,
        // 4.5 normal text, 3.0 for >=18.66px bold / >=24px
        large: parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight) >= 700),
      });
    }
    // Placeholder pseudo-elements can't be queried via selector — probe via matchMedia-ish trick
    const toInput = document.querySelector('#compose-to');
    const ph = getComputedStyle(toInput, '::placeholder');
    const phFg = parse2(ph.color);
    const phBg = bgOf2(toInput);
    out.push({
      sel: '#compose-to::placeholder',
      color: ph.color,
      bg: `rgb(${phBg.r}, ${phBg.g}, ${phBg.b})`,
      ratio: phFg ? +(((Math.max(lum2(phFg), lum2(phBg)) + 0.05) / (Math.min(lum2(phFg), lum2(phBg)) + 0.05)).toFixed(2)) : null,
      large: false,
      isPlaceholder: true,
    });
    return out;
  });

  console.log(`\n===== ${label} =====`);
  let pass = true;
  for (const r of report) {
    if (r.missing) { console.log(`  MISSING: ${r.sel}`); pass = false; continue; }
    const threshold = r.isPlaceholder ? 3.0 : (r.large ? 3.0 : 4.5);
    // placeholder is decorative-ish but should still be readable
    const ok = r.ratio !== null && r.ratio >= threshold;
    if (!ok) pass = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.ratio}:1  ${r.sel}  (color ${r.color} on ${r.bg})`);
  }

  // Top bar controls (outside .md-theme — the same class of bug)
  const topbar = await page.evaluate(() => {
    const out = [];
    const lum3 = ({ r, g, b }) => {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse3 = (s) => {
      const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
    };
    for (const [name, el] of [['status text', document.querySelector('.md-topbar-status')], ['compose btn', document.querySelector('.md-topbar .md-btn-primary')]]) {
      if (!el) { out.push({ name, missing: true }); continue; }
      const cs = getComputedStyle(el);
      const fg = parse3(cs.color);
      // Walk ancestors for the first opaque background (same as modal audit)
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      let n = el;
      while (n && n !== document.documentElement) {
        const c = parse3(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.9) { bg = c; break; }
        n = n.parentElement;
      }
      const ratio3 = fg ? +(((Math.max(lum3(fg), lum3(bg)) + 0.05) / (Math.min(lum3(fg), lum3(bg)) + 0.05)).toFixed(2)) : null;
      out.push({ name, color: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: ratio3, btnBgSet: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' });
    }
    return out;
  });
  for (const t of topbar) {
    if (t.missing) { console.log(`  MISSING: topbar ${t.name}`); pass = false; continue; }
    const ok = t.ratio !== null && t.ratio >= 4.5 && (t.name !== 'compose btn' || t.btnBgSet);
    if (!ok) pass = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  topbar ${t.name}: ratio ${t.ratio}:1 (color ${t.color} on ${t.bg})`);
  }

  await page.screenshot({ path: `contrast-fixed-${label}.png` });
  await page.evaluate(() => document.querySelector('.md-modal-close').click());
  await sleep(300);
  return pass;
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
  all &= await audit(page, 'today');

  await page.evaluate(() => {
    [...document.querySelectorAll('.md-nav-item')].find((el) => el.textContent.trim().includes('Trends')).click();
  });
  await sleep(1400);
  all &= await audit(page, 'trends');

  await browser.close();
  console.log(all ? '\nCONTRAST AUDIT PASSED' : '\nCONTRAST AUDIT FAILED');
  process.exit(all ? 0 : 1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
