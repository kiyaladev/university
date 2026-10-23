import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:15034';
const api = process.argv[3] || 'http://127.0.0.1:15031/api';
if ([base, api].some((url) => !['localhost', '127.0.0.1'].includes(new URL(url).hostname)))
  throw Error('Recette locale obligatoire');
const browser = await chromium.launch();
const checks = [];
try {
  const response = await fetch(api + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@unipresence.gn', password: 'Passer@2026' }),
  });
  assert.equal(response.status, 201);
  const { token } = await response.json();
  const rows = await (await fetch(api + '/vod?all=true', { headers: { Authorization: 'Bearer ' + token } })).json();
  const medias = rows.data.filter((row) => row.url.startsWith('/media/demonstration/'));
  assert.equal(medias.length, 3);
  const page = await browser.newPage({ locale: 'fr-FR' });
  const failures = [];
  page.on('requestfailed', (request) => failures.push(request.url()));
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(base + '/#/connexion');
  await page.locator('input[type=email]').fill('admin@unipresence.gn');
  await page.locator('input[type=password]').fill('Passer@2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL((url) => url.hash !== '#/connexion');
  for (const resource of medias) {
    await page.goto(base + '/#/vod/lecteur/' + resource.id, { waitUntil: 'networkidle' });
    const tag = resource.type === 'AUDIO' ? 'audio' : 'video';
    await page.locator(tag).waitFor();
    await page.waitForFunction((tag) => {
      const media = document.querySelector(tag);
      return media.readyState >= 1 && Number.isFinite(media.duration);
    }, tag);
    const result = await page.locator(tag).evaluate((media) => ({
      duration: media.duration,
      source: media.getAttribute('src'),
      error: media.error?.message,
    }));
    assert.ok(Math.abs(result.duration - 3) < 0.2);
    assert.equal(result.error, undefined);
    assert.equal(result.source, resource.url);
    checks.push({ type: resource.type, source: result.source, duration: result.duration, result: 'OK' });
  }
  const vignette = await page.request.get(base + '/media/demonstration/vignette.svg');
  assert.equal(vignette.status(), 200);
  assert.match(vignette.headers()['content-type'], /image\/svg\+xml/);
  assert.deepEqual(failures, []);
  const report = { date: new Date().toISOString(), checks, vignette: 'OK', networkErrors: failures };
  fs.writeFileSync(process.argv[4] || '/tmp/university-medias.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
