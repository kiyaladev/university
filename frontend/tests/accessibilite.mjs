/** Audit automatique ; les essais clavier complètent cette preuve. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:15034';
const axePath = process.argv[3];
const report = process.argv[4] || '/tmp/university-accessibilite.json';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !axePath) throw Error('URL locale et fichier axe-core obligatoires');
const browser = await chromium.launch();
const results = [];
const scenarios = [
  { role: 'CONTROLEUR', email: 'controleur1@unipresence.gn', paths: ['/controle', '/emploi-du-temps'] },
  { role: 'SCOLARITE', email: 'scolarite@unipresence.gn', paths: ['/scolarite', '/inscriptions', '/paiements'] },
  { role: 'ADMIN', email: 'admin@unipresence.gn', paths: ['/audit'] },
];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ locale: 'fr-FR', colorScheme: 'light' });
    const page = await context.newPage();
    async function scan(path, width) {
      // Mesurer les couleurs finales ; un fondu de notification n'est pas un état lisible.
      await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }' });
      await page.waitForFunction(() => !document.querySelector('.q-table__linear-progress, .q-btn--loading, .q-notification'), { timeout: 15000 });
      await page.waitForTimeout(350);
      await page.addScriptTag({ path: axePath });
      const result = await page.evaluate(async () => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
      const contrastEvidence = await page.evaluate(nodes => nodes.map(node => {
        const element = document.querySelector(node.target[0]);
        if (!element) return { found: false };
        const parse = value => {
          const match = value.match(/rgba?\(([^)]+)\)/);
          if (!match) return null;
          const parts = match[1].split(',').map(part => Number.parseFloat(part.trim()));
          return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
        };
        const blend = (top, bottom) => top.rgb.map((channel, index) => channel * top.alpha + bottom[index] * (1 - top.alpha));
        const backgrounds = [];
        for (let current = element; current; current = current.parentElement) {
          const background = parse(getComputedStyle(current).backgroundColor);
          if (background && background.alpha > 0) backgrounds.push(background);
        }
        let background = [255, 255, 255];
        for (const layer of backgrounds.reverse()) background = blend(layer, background);
        const style = getComputedStyle(element);
        const foreground = parse(style.color);
        const visibleForeground = foreground ? blend(foreground, background) : null;
        const luminance = rgb => rgb.map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const ratio = visibleForeground ? (() => {
          const values = [luminance(visibleForeground), luminance(background)].sort((a, b) => b - a);
          return Number(((values[0] + 0.05) / (values[1] + 0.05)).toFixed(2));
        })() : null;
        return {
          found: true,
          foreground: style.color,
          background: `rgb(${background.map(Math.round).join(', ')})`,
          contrastRatio: ratio,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
        };
      }), result.incomplete.flatMap(rule => rule.nodes));
      let contrastIndex = 0;
      const row = {
        role: scenario.role,
        path,
        width,
        theme: await page.locator('body').evaluate(element => element.classList.contains('body--dark') ? 'dark' : 'light'),
        violations: result.violations,
        incomplete: result.incomplete.map(rule => ({
          id: rule.id,
          nodes: rule.nodes.map(node => ({
            target: node.target,
            html: node.html.replace(/>([^<>]+)</g, '>[texte de test masqué]<'),
            summary: node.summary,
            contraste: contrastEvidence[contrastIndex++],
            checks: [...node.any, ...node.all, ...node.none]
              .filter(check => check.result === 'incomplete')
              .map(({ id, message, data }) => ({ id, message, data })),
          })),
        })),
      };
      results.push(row);
      console.log(JSON.stringify({ role: row.role, path, width, violations: row.violations.map(rule => ({ id: rule.id, impact: rule.impact, count: rule.nodes.length, targets: rule.nodes.slice(0, 3).map(node => node.target) })) }));
      fs.writeFileSync(report, JSON.stringify({ date: new Date().toISOString(), axeVersion: result.testEngine.version, reference: 'https://www.w3.org/TR/WCAG22/', results }, null, 2));
    }
    await page.goto(base + '/#/connexion', { waitUntil: 'networkidle' });
    if (scenario.role === 'CONTROLEUR') await scan('/connexion', 1280);
    await page.locator('input[type=email]').fill(scenario.email);
    await page.locator('input[type=password]').fill('Passer@2026');
    await page.locator('button[type=submit]').click();
    await page.waitForURL(url => !url.hash.startsWith('#/connexion'));
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 950 });
      for (const path of scenario.paths) {
        await page.goto(base + '/#' + path, { waitUntil: 'networkidle' });
        await page.waitForSelector('.q-page');
        await scan(path, width);
      }
    }
    await page.getByRole('button', { name: 'Basculer le thème' }).click();
    await page.waitForSelector('body.body--dark');
    for (const path of scenario.paths) {
      await page.goto(base + '/#' + path, { waitUntil: 'networkidle' });
      await scan(path, 375);
    }
    await context.close();
  }
} finally { await browser.close(); }
const ratios = results.flatMap(row => row.incomplete.flatMap(rule => rule.nodes.map(node => node.contraste?.contrastRatio).filter(Number.isFinite)));
const minimumContrast = ratios.length ? Math.min(...ratios) : null;
console.log(JSON.stringify({ contrastCandidates: ratios.length, minimumContrast }));
if (results.some(row => row.violations.length) || (minimumContrast !== null && minimumContrast < 4.5)) process.exitCode = 1;
