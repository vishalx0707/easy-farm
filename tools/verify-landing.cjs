const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { createAppServer } = require('../server');

(async () => {
  const server = createAppServer((_req, res) => res.writeHead(404).end(), {
    staticRoot: path.resolve(__dirname, '..'),
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const errors = [];
    for (const width of [360, 390, 768, 1440]) {
      const height = width === 360 ? 780 : width === 390 ? 844 : width === 768 ? 600 : 900;
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin);
      await page.locator('#film').evaluate(video => new Promise(resolve => {
        if (!video.paused) return resolve();
        video.addEventListener('play', resolve, { once: true });
        setTimeout(resolve, 5000);
      }));
      assert.equal(await page.locator('.hero-actions a').first().getAttribute('href'), '/grower');
      assert.equal(await page.locator('.hero-actions a').last().getAttribute('href'), '/buyer');
      assert.equal(await page.locator('.topbar nav a').last().getAttribute('href'), '/login');
      for (let stage = 0; stage < 5; stage++) {
        await page.locator(`button[data-stage="${stage}"]`).click();
        assert.equal(await page.locator('#stage-pane').getAttribute('data-stage'), String(stage));
        await page.locator('#stage-pane img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px stage ${stage}`);
        assert.equal(await page.locator('button[data-stage][aria-current="step"]').count(), 1);
      }
      await page.locator('button[data-stage="2"]').click();
      await page.locator('[data-period="30"]').click();
      assert.equal(await page.locator('[data-period="30"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-period="30"]').evaluate(el => el === document.activeElement), true);
      await page.locator('[data-view="grower"]').click();
      assert.equal(await page.locator('button[data-stage="1"]').getAttribute('aria-label'), 'List your harvest');
      await page.locator('button[data-stage="3"]').click();
      await page.locator('#trade-next').click();
      await page.locator('#trade-next').click();
      assert.match(await page.locator('#lot-state').innerText(), /Accepted/);
      await page.locator('#trade-next').click();
      await page.locator('[data-delivery="2"]').click();
      assert.match(await page.locator('#stage-pane h3').innerText(), /Received/);
      await page.locator('button[data-stage="1"]').click();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#stage-pane').getAttribute('data-stage'), '1', 'Scrolling must not replace the selected preview');
      await page.locator('button[data-stage="0"]').click();
      await page.locator('#stage-pane img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      if ([390, 1440].includes(width)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `design/qa-landing-after-${width}.png`, fullPage: true });
      }
      assert.equal(await page.evaluate(() => document.querySelector('#marketplace').offsetHeight < 1100), true, 'Preview must not add empty scroll distance');
      await page.close();
    }
    const reduced = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await reduced.newPage();
    await page.goto(origin);
    assert.equal(await page.locator('#film').getAttribute('src'), null, 'Reduced motion must not download autoplay footage');
    await page.locator('#film-toggle').click();
    await page.waitForFunction(() => !document.querySelector('#film').paused);
    await page.locator('#film-toggle').click();
    assert.equal(await page.locator('#film').evaluate(v => v.paused), true);
    await page.goto(origin + '/#trace');
    await page.waitForFunction(() => document.querySelector('#stage-pane').dataset.stage === '4');
    assert.equal(await page.locator('#stage-pane').getAttribute('data-stage'), '4');
    await reduced.close();
    assert.deepEqual(errors, []);
    console.log('PASS landing: 360/390/768/1440px, all five stages, roles, price filters, acceptance, delivery, real portal links, images, stable scrolling, film controls, reduced motion, legacy trace link; no overflow or page errors.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

