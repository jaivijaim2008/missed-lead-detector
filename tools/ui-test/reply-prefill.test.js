/**
 * Reply pre-fill test: opens the compose modal from a Leads row ("Write
 * reply") and from the Inbox reading pane ("Reply"), asserting the To and
 * Subject fields come pre-filled with the sender's address and "Re: …".
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function assertPrefill(page, label, expectToContains) {
  await page.waitForSelector('.md-modal', { timeout: 10000 });
  await sleep(400);
  const state = await page.evaluate(() => ({
    to: document.querySelector('#compose-to')?.value ?? null,
    subject: document.querySelector('#compose-subject')?.value ?? null,
  }));
  const toOk = state.to && state.to.includes(expectToContains);
  const subjOk = state.subject && state.subject.startsWith('Re:');
  console.log(`[${label}] To="${state.to}" | Subject="${state.subject}"`);
  console.log(`[${label}] to pre-filled: ${toOk ? 'PASS' : 'FAIL'} | subject starts with "Re:": ${subjOk ? 'PASS' : 'FAIL'}`);
  await page.screenshot({ path: `reply-prefill-${label}.png` });
  await page.evaluate(() => document.querySelector('.md-modal-close')?.click());
  await sleep(350);
  return toOk && subjOk;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/#/leads', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1800);

  // ── Leads page: "Write reply" on the first row ──
  console.log('== Leads page ==');
  const leadInfo = await page.evaluate(() => {
    const row = document.querySelector('.md-table tbody tr');
    if (!row) return null;
    const emailCell = row.querySelector('.md-contact span');
    const writeBtn = [...row.querySelectorAll('button')].find((b) => b.textContent.includes('Write reply'));
    if (writeBtn) writeBtn.click();
    return { email: emailCell ? emailCell.textContent.trim() : '' };
  });
  if (!leadInfo) { console.error('No lead rows found'); process.exit(1); }
  let all = true;

  // The displayed text may be the company; extract the email local part heuristically
  const expectFragment = leadInfo.email.includes('@')
    ? leadInfo.email.split('@')[0].slice(0, 8)
    : leadInfo.email.slice(0, 6).toLowerCase();
  all &= await assertPrefill(page, 'leads-row', expectFragment);

  // ── Inbox page: select a mail, click "Reply" in the reading pane ──
  console.log('== Inbox page ==');
  await page.evaluate(() => {
    window.location.hash = '#/emails';
  });
  await sleep(1800);
  const inboxInfo = await page.evaluate(() => {
    const row = document.querySelector('.md-mailrow');
    if (!row) return null;
    row.click();
    return true;
  });
  await sleep(900);
  if (!inboxInfo) { console.error('No inbox rows found'); process.exit(1); }
  const clickedReply = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Reply');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clickedReply) { console.error('Reply button not found in reading pane'); process.exit(1); }
  all &= await assertPrefill(page, 'inbox-pane', '@');

  await browser.close();
  console.log(all ? '\nREPLY PREFILL TESTS PASSED' : '\nREPLY PREFILL TESTS FAILED');
  process.exit(all ? 0 : 1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
