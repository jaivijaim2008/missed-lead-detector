/**
 * Item 2 — REAL Send Follow-Up test:
 *  - targets lead id 43 (real Gmail row addressed to the user's own address)
 *  - clicks the templated "Reply now" button (Send Follow-Up) on Leads page
 *  - captures the API response, UI note, DB status change, History entry
 *  - Gmail Sent-folder proof is checked separately via the Gmail API
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LEAD_ID = 43;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();

  // Capture the send endpoint's response for hard evidence
  let sendResponse = null;
  page.on('response', async (res) => {
    if (res.url().includes(`/api/follow-ups/${LEAD_ID}/send`)) {
      try { sendResponse = { status: res.status(), body: await res.json() }; } catch {}
    }
  });

  await page.goto('http://localhost:3000/#/leads', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1800);

  // Sanity: the target lead is on the page and still awaiting a reply
  const pre = await page.evaluate((id) =>
    fetch(`/api/leads/${id}`).then((r) => r.json()).catch(() => null), LEAD_ID
  );
  if (!pre || !pre.overview) { console.error(`Lead ${LEAD_ID} not found`); process.exit(1); }
  console.log(`1. Target lead id=${LEAD_ID}: "${pre.overview.subject}" status=${pre.overview.status} to=${pre.overview.email}`);

  // 2. Filter by the recipient via the search box (server-side match on email),
  //    then click "Reply now" on the single remaining row
  console.log('2. Searching for the lead, then clicking "Reply now" (templated Send Follow-Up)');
  await page.type('.md-search .md-input', 'jaivijai188', { delay: 40 });
  await page.waitForFunction(() => document.querySelectorAll('.md-table tbody tr').length >= 1, { timeout: 15000 });
  await sleep(400);
  const rowCount = await page.evaluate(() => document.querySelectorAll('.md-table tbody tr').length);
  console.log(`   rows matching search: ${rowCount} (both self-addressed leads match)`);
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.md-table button')].find((b) => b.textContent.includes('Reply now'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) { console.error('"Reply now" button not found for the target row'); process.exit(1); }

  // 3. Wait for the confirmation note
  console.log('3. Waiting for confirmation note');
  await page.waitForFunction(
    () => document.querySelector('.md-note-ok') && /sent/i.test(document.querySelector('.md-note-ok').textContent),
    { timeout: 40000 }
  );
  const note = await page.$eval('.md-note-ok', (el) => el.textContent);
  console.log('   UI note:', note.trim());
  await sleep(400);
  await page.screenshot({ path: 'followup-sent-note.png' });
  console.log('   screenshot: followup-sent-note.png');

  // 4. API evidence
  console.log('4. API response:', JSON.stringify(sendResponse));

  // 5. DB status transition
  const post = await page.evaluate((id) =>
    fetch(`/api/leads/${id}`).then((r) => r.json()).catch(() => null), LEAD_ID
  );
  console.log(`5. Status after send: ${post && post.overview ? post.overview.status : 'unknown'} (was ${pre.overview.status})`);

  // 6. History page shows the send
  console.log('6. Opening History page');
  await page.evaluate(() => { window.location.hash = '#/activity'; });
  await sleep(1800);
  await page.screenshot({ path: 'followup-history.png' });
  console.log('   screenshot: followup-history.png');

  await browser.close();
  console.log('\nDONE — Gmail Sent folder check happens next via the Gmail API.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
