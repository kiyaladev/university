import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:15034';
const report = process.argv[3] || '/tmp/university-navigation.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('API locale obligatoire');
const browser = await chromium.launch();
const results = [];
const roles = [
  ['ADMIN', 'admin@unipresence.gn', '/', 4], ['DIRECTION', 'direction@unipresence.gn', '/', 4],
  ['SCOLARITE', 'scolarite@unipresence.gn', '/scolarite', 4], ['CONTROLEUR', 'controleur1@unipresence.gn', '/controle', 2],
  ['ENSEIGNANT', 'enseignant@unipresence.gn', '/mes-seances', 3], ['CHEF_DEPARTEMENT', 'chef.info@unipresence.gn', '/', 4],
  ['ETUDIANT', 'etudiant1@university.gn', '/portail', 3],
];
try {
  for (const [role, email, home, quickCount] of roles) {
    const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 950 } });
    const page = await context.newPage();
    await page.goto(base + '/#/connexion');
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(role === 'ETUDIANT' ? 'Etu#2026' : 'Passer@2026');
    await page.locator('button[type=submit]').click();
    await page.waitForURL(url => url.hash === '#' + home);
    const drawer = page.locator('.q-drawer');
    await drawer.locator('.index__repere').waitFor();
    const quick = drawer.locator('nav > a.index__lien, [role=navigation] > a.index__lien');
    assert.equal(await quick.count(), quickCount, role + ' raccourcis');
    const groups = drawer.locator('.q-expansion-item');
    assert.ok(await groups.count() <= 5);
    const links = [];
    const rubriqueParLien = new Map();
    for (let i = 0; i < await groups.count(); i++) {
      const header = groups.nth(i).locator('.q-expansion-item__container > .q-item').first();
      await header.click();
      await page.waitForTimeout(250);
      assert.equal(await drawer.locator('.q-expansion-item--expanded').count(), 1, role + ' accordéon');
      const hrefs = await groups.nth(i).locator('a').evaluateAll(items => items.map(item => item.getAttribute('href')));
      links.push(...hrefs);
      for (const href of hrefs) rubriqueParLien.set(href, await header.innerText());
    }
    links.push(...await quick.evaluateAll(items => items.map(item => item.getAttribute('href'))));
    assert.equal(new Set(links).size, links.length, role + ' liens uniques');
    if (role === 'ADMIN') {
      assert.match(rubriqueParLien.get('#/bibliotheque-gestion') ?? '', /Campus/);
      assert.match(rubriqueParLien.get('#/formations-admin') ?? '', /Campus/);
      assert.match(rubriqueParLien.get('#/evaluations') ?? '', /Scolarité/);
      assert.match(rubriqueParLien.get('#/reclamations') ?? '', /Scolarité/);
    }
    const search = drawer.getByRole('searchbox', { name: 'Rechercher un module' });
    if (role === 'ETUDIANT') {
      await search.fill('vidéo');
      assert.equal(await drawer.locator('a:visible').count(), 1, 'recherche du libellé vidéo étudiant');
      assert.match(await drawer.locator('a:visible').first().innerText(), /Cours en vidéo/);
    }
    await search.fill('emploi');
    assert.equal(await drawer.locator('a:visible').count(), 1, role + ' recherche');
    await search.fill('zzzintrouvable');
    assert.equal(await drawer.locator('a:visible').count(), 0);
    await drawer.getByRole('status').waitFor();
    await search.fill('');
    if (role === 'ADMIN') {
      await search.fill('inscriptions');
      await drawer.locator('a[href="#/inscriptions"]').click();
      await page.waitForURL(url => url.hash === '#/inscriptions');
      assert.equal(await search.inputValue(), '');
      await page.goto(base + '/#/audit', { waitUntil: 'networkidle' });
      assert.equal(await drawer.locator('.q-expansion-item--expanded').innerText().then(value => value.includes('Administration')), true);
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
    await drawer.locator('a.index__lien').first().click();
    await page.waitForTimeout(400);
    assert.equal(await drawer.evaluate(element => element.classList.contains('q-layout--prevent-focus')), true, role + ' fermeture mobile');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    results.push({ role, quickCount, uniqueLinks: links.length, accordion: 'OK', search: 'OK', mobile: 'OK' });
    await context.close();
  }
  fs.writeFileSync(report, JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
