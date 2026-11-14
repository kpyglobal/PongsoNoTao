// quick visual iteration: node scripts/dev/peek.mjs '[{"file":"out.png","period":"day","cam":{...},"origin":"yayo"}]'
import { withHarness, debugUrl } from '../lib/harness.mjs';

const shots = JSON.parse(process.argv[2] || '[]');
await withHarness({ port: Number(process.env.PORT || 8799) }, async ({ browser, base }) => {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 500)));
  page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
  await page.setViewport({ width: 1440, height: 900 });
  const t0 = Date.now();
  await page.goto(debugUrl(base), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 180000, polling: 500 });
  console.log('ready in', Date.now() - t0, 'ms');
  for (const s of shots) {
    if (s.viewport) await page.setViewport(s.viewport);
    await page.evaluate((s) => {
      const g = window.__TAO_RPG__;
      if (s.origin) g.selectOrigin(s.origin);
      if (s.period) g.setTime(s.period);
      if (s.season) g.setSeason(s.season);
      if (s.tp) g.teleport(s.tp[0], s.tp[1]);
      if (s.closeDialogue) g.closeAll();
      if (s.cam) g.setCamera({ ...s.cam, snap: true });
      if (s.js) (0, eval)(s.js);
    }, s);
    await new Promise((r) => setTimeout(r, s.wait ?? 2500));
    const t1 = Date.now();
    await page.screenshot({ path: s.file });
    const info = await page.evaluate(() => window.__TAO_RPG__.renderInfo());
    console.log('shot', s.file, Date.now() - t1, 'ms', JSON.stringify(info));
  }
});
