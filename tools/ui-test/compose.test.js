/**
 * Real end-to-end UI test of the Compose feature, driven through Chrome:
 *  1. Opens http://localhost:3000
 *  2. Clicks the top-bar Compose button -> screenshot of the open modal
 *  3. Fills To/Subject/Body, clicks Send
 *  4. Waits for the success toast -> screenshot
 *  5. Navigates to History -> screenshot of the "Email Sent" entry
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SUBJECT = `Compose UI test ${STAMP}`;
const RECIPIENT = 'jaivijai188@gmail.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    // 1. Open the dashboard
    console.log('1. Opening', BASE);
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);

    // 2. Click the top-bar Compose button
    console.log('2. Clicking Compose button');
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find((el) => el.textContent.trim().includes('Compose'));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicked) throw new Error('Compose button not found in top bar');
    await page.waitForSelector('.md-modal', { timeout: 10000 });
    await sleep(400);

    // 3. Validation: with empty fields the Send button is disabled (send blocked)
    console.log('3. Validation: Send disabled while fields are empty');
    const emptyState = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.md-modal button')];
      const send = btns.find((el) => el.textContent.includes('Send'));
      return { modalOpen: !!document.querySelector('.md-modal'), sendDisabled: send ? send.disabled : null };
    });
    console.log('   modal open:', emptyState.modalOpen, '| send disabled:', emptyState.sendDisabled);
    if (!emptyState.modalOpen || !emptyState.sendDisabled) {
      throw new Error('Empty fields must disable the Send button');
    }

    // 3b. Malformed To + filled body -> button enabled -> inline field error on click
    console.log('3b. Validation: malformed To shows inline error');
    await page.type('#compose-to', 'not-an-email');
    await page.type('#compose-body', 'validation probe');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.md-modal button')];
      const send = btns.find((el) => el.textContent.includes('Send'));
      if (send) send.click();
    });
    await sleep(400);
    const errState = await page.evaluate(() => ({
      modalOpen: !!document.querySelector('.md-modal'),
      fieldErrors: [...document.querySelectorAll('.md-field-err')].map((e) => e.textContent),
    }));
    console.log('   modal still open:', errState.modalOpen, '| errors:', JSON.stringify(errState.fieldErrors));
    if (!errState.modalOpen || errState.fieldErrors.length === 0) {
      throw new Error('Malformed To should show an inline error and keep the modal open');
    }
    // Typed body must be preserved
    const preserved = await page.$eval('#compose-body', (el) => el.value);
    console.log('   typed body preserved:', JSON.stringify(preserved));
    if (preserved !== 'validation probe') throw new Error('Typed body was lost!');

    // Screenshot of the compose modal (with validation errors visible)
    await page.screenshot({ path: 'compose-modal.png' });
    console.log('   screenshot: compose-modal.png');

    // 4. Fix the recipient, fill the subject, and send for real
    console.log('4. Correcting fields and sending');
    await page.$eval('#compose-to', (el) => { el.value = ''; });
    await page.type('#compose-to', RECIPIENT);
    await page.type('#compose-subject', SUBJECT);
    await page.$eval('#compose-body', (el) => { el.value = ''; });
    await page.type('#compose-body', 'Hello! This email was composed and sent through the new LeadGuard dashboard compose feature during an end-to-end UI test. If you are reading this in Gmail, the feature works for real.');
    await page.screenshot({ path: 'compose-modal-filled.png' });
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.md-modal button')];
      const send = btns.find((el) => el.textContent.includes('Send'));
      if (send) send.click();
    });

    // 5. Wait for modal to close + success toast
    console.log('5. Waiting for success toast');
    await page.waitForFunction(
      () => !document.querySelector('.md-modal') && !!document.querySelector('.md-toast'),
      { timeout: 30000 }
    );
    const toastText = await page.$eval('.md-toast', (el) => el.textContent);
    console.log('   toast:', toastText.trim());
    await sleep(300);
    await page.screenshot({ path: 'compose-sent-toast.png' });
    console.log('   screenshot: compose-sent-toast.png');

    // 6. Navigate to History and find the Email Sent entry
    console.log('6. Opening History page');
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.md-nav-item')];
      const history = items.find((el) => el.textContent.trim().includes('History'));
      if (history) history.click();
    });
    await page.waitForFunction(
      (subj) => document.body.innerText.includes(subj),
      { timeout: 20000 },
      SUBJECT
    );
    await sleep(600);
    await page.screenshot({ path: 'history-email-sent.png' });
    console.log('   screenshot: history-email-sent.png');
    console.log('   History shows the sent entry with subject:', SUBJECT);

    console.log('\nALL UI TESTS PASSED');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('UI TEST FAILED:', err.message);
  process.exit(1);
});
