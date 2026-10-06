/** Recette en lecture seule du journal sur l'environnement QA local. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:15029';
const report = process.argv[3] || '/tmp/university-journal.json';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Recette réservée à localhost');
const browser = await chromium.launch();
const checks = [];
try {
  for (const [role, email] of [['ADMIN', 'admin@unipresence.gn'], ['DIRECTION', 'direction@unipresence.gn']]) {
    for (const locale of ['fr-FR', 'en-US']) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.addInitScript(locale => {
      localStorage.setItem('unipresence_token', 'journal-ui-test-token');
      localStorage.setItem('lang', locale);
    }, locale);
    await page.route('**/api/auth/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: `user-${role}`, email, nom: 'Admin', prenom: 'Test', role }),
    }));
    await page.route('**/api/controles/audit*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'sms-batch-1', action: 'SMS_DIFFUSION_DEMANDEE', entite: 'Notification',
          entiteId: null, createdAt: '2026-10-03T10:00:00.000Z',
          details: JSON.stringify({
            lotId: '00000000-0000-4000-8000-000000000001', canal: 'SMS',
            statutInitial: 'EN_ATTENTE', nombreDestinataires: 3, messagesPresents: 2,
          }),
          user: { nom: 'Admin', prenom: 'Test', role: 'ADMIN' },
        }, {
          id: 'document-download-1', action: 'DOCUMENT_DEPOT_TELECHARGE', entite: 'DocumentDepot',
          entiteId: 'document-1', createdAt: '2026-10-03T09:00:00.000Z',
          details: JSON.stringify({ compteur: 'telechargements' }),
          user: { nom: 'Admin', prenom: 'Test', role: 'ADMIN' },
        }, {
          id: 'payment-reference-1', action: 'PAIEMENT_TRANSACTION_LIEE', entite: 'Paiement',
          entiteId: 'payment-1', createdAt: '2026-10-03T08:00:00.000Z',
          details: JSON.stringify({ champsModifies: ['transactionId'] }),
          user: { nom: 'Admin', prenom: 'Test', role: 'ADMIN' },
        }, {
          id: 'student-account-created-1', action: 'COMPTE_ETUDIANT_CREE', entite: 'Etudiant',
          entiteId: 'student-1', createdAt: '2026-10-03T07:00:00.000Z',
          details: JSON.stringify({ avant: null, apres: { compteLie: true, role: 'ETUDIANT', actif: true } }),
          user: null,
        }, {
          id: 'student-account-linked-1', action: 'COMPTE_ETUDIANT_RATTACHE', entite: 'Etudiant',
          entiteId: 'student-2', createdAt: '2026-10-03T06:00:00.000Z',
          details: JSON.stringify({ avant: { compteLie: false }, apres: { compteLie: true, role: 'ETUDIANT', actif: true } }),
          user: null,
        }],
        total: 5, page: 1, pageSize: 25,
      }),
    }));
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(base + '/#/audit', { waitUntil: 'networkidle' });
      const english = locale === 'en-US';
      await page.getByRole('heading', { name: english ? 'Audit log' : 'Journal d’audit', exact: true }).waitFor();
      if (role === 'ADMIN' && locale === 'fr-FR' && width === 1440) {
        const dialogueNomme = await page.evaluate(async () => {
          const dialogue = document.createElement('div');
          dialogue.setAttribute('role', 'dialog');
          dialogue.className = 'q-dialog';
          dialogue.innerHTML = '<div class="text-h6">Titre du dialogue de test</div>';
          document.body.append(dialogue);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const reference = dialogue.getAttribute('aria-labelledby');
          const nom = reference ? dialogue.querySelector(`#${CSS.escape(reference)}`)?.textContent?.trim() : '';
          dialogue.remove();
          return nom === 'Titre du dialogue de test';
        });
        if (!dialogueNomme) throw Error('Le dialogue sans libellé n’a pas été relié à son titre visible.');
        const dialogueAsynchroneNomme = await page.evaluate(async () => {
          const dialogue = document.createElement('div');
          dialogue.setAttribute('role', 'dialog');
          dialogue.className = 'q-dialog';
          const titre = document.createElement('div');
          titre.className = 'text-h6';
          dialogue.append(titre);
          document.body.append(dialogue);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          titre.textContent = 'Titre chargé après ouverture';
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const reference = dialogue.getAttribute('aria-labelledby');
          const nom = reference ? dialogue.querySelector(`#${CSS.escape(reference)}`)?.textContent?.trim() : '';
          dialogue.remove();
          return nom === 'Titre chargé après ouverture';
        });
        if (!dialogueAsynchroneNomme) throw Error('Le dialogue au titre chargé après ouverture n’a pas de nom accessible.');
      }
      const details = page.getByRole('button', { name: english ? 'Details' : 'Détails', exact: true });
      await details.first().waitFor();
      await page.getByText(english ? 'SMS broadcast requested' : 'Diffusion SMS demandée', { exact: true }).waitFor();
      await page.getByText(english ? 'Document downloaded' : 'Téléchargement d’un document', { exact: true }).waitFor();
      await page.getByText(english ? 'Mobile Money reference linked' : 'Référence Mobile Money rattachée', { exact: true }).waitFor();
      await page.getByText(english ? 'Student portal account created' : 'Compte portail étudiant créé', { exact: true }).waitFor();
      await page.getByText(english ? 'Student portal account linked' : 'Compte portail étudiant rattaché', { exact: true }).waitFor();
      await details.first().click();
      await page.getByRole('dialog').waitFor();
      await page.getByText(english ? '3 recipient(s), 2 message(s) with content.' : '3 destinataire(s), 2 message(s) avec contenu.', { exact: true }).waitFor();
      await page.getByRole('button', { name: english ? 'Close' : 'Fermer', exact: true }).click();
      const entity = page.getByLabel(english ? 'Entity' : 'Entité', { exact: true });
      await entity.fill('User');
      await page.getByRole('button', { name: english ? 'Search' : 'Rechercher', exact: true }).click();
      await page.waitForLoadState('networkidle');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Débordement mobile');
      await page.screenshot({ path: report.replace(/\.json$/, '') + `-${role}-${locale}-${width}.png`, fullPage: true });
      checks.push({ role, locale, width, result: 'OK', details: 'Chargement, détail, filtre entité et absence de débordement' });
    }
    if (errors.length) throw Error(errors.join('\n'));
    await context.close();
    }
  }
  fs.writeFileSync(report, JSON.stringify({ date: new Date().toISOString(), checks }, null, 2));
  console.log(JSON.stringify(checks));
} finally { await browser.close(); }
