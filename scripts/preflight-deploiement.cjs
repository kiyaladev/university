#!/usr/bin/env node
/** Inspection en lecture seule ; aucun secret n'est inclus dans le rapport. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'backend');
const dotenv = require(path.join(backend, 'node_modules/dotenv'));
const { PrismaClient } = require(path.join(backend, 'node_modules/@prisma/client'));
const { motDePasseDemo } = require(path.join(backend, 'dist/common/demo-accounts'));
const config = { ...dotenv.parse(fs.readFileSync(path.join(backend, '.env'))), ...process.env };
const prisma = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });

/**
 * Dérive nginx : compare, en lecture seule, les fichiers de infra/nginx/ à ceux
 * réellement en place sur le serveur. Un écart produit un avertissement, jamais
 * un blocage : le dépôt peut légitimement précéder la production.
 */
function comparerNginx() {
  const depot = path.join(root, 'infra/nginx');
  const paires = [];
  const lister = (dossier) => fs.existsSync(dossier) ? fs.readdirSync(dossier, { withFileTypes: true }).filter(f => f.isFile()) : [];
  for (const f of lister(depot)) {
    if (f.name !== 'README.md') paires.push([path.join(depot, f.name), path.join('/etc/nginx/sites-available', f.name)]);
  }
  for (const f of lister(path.join(depot, 'snippets'))) {
    paires.push([path.join(depot, 'snippets', f.name), path.join('/etc/nginx/snippets', f.name)]);
  }
  const fichiers = paires.map(([source, cible]) => {
    let etat;
    try {
      if (!fs.existsSync(cible)) etat = 'absent';
      else etat = fs.readFileSync(source).equals(fs.readFileSync(cible)) ? 'identique' : 'different';
    } catch {
      etat = 'illisible';
    }
    return { depot: path.relative(root, source), production: cible, etat };
  });
  const avertissements = fichiers.filter(f => f.etat !== 'identique')
    .map(f => `nginx : ${f.depot} ${f.etat === 'different' ? 'diffère de' : f.etat === 'absent' ? 'absent en' : 'non comparable avec'} ${f.production} (voir infra/nginx/README.md).`);
  for (const a of avertissements) console.warn(`AVERTISSEMENT ${a}`);
  return { fichiers, avertissements };
}

async function inspecter() {
  const nginx = comparerNginx();
  const users = await prisma.user.findMany({ where: { actif: true }, select: { role: true, password: true } });
  let comptesDemo = 0;
  let administrateursReels = 0;
  for (const user of users) {
    const demo = await motDePasseDemo(user.password);
    if (demo) comptesDemo++;
    else if (user.role === 'ADMIN') administrateursReels++;
  }
  const appliquees = await prisma.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  const noms = new Set(appliquees.map(m => m.migration_name));
  const attendues = fs.readdirSync(path.join(backend, 'prisma/migrations'), { withFileTypes: true }).filter(f => f.isDirectory()).map(f => f.name);
  const enAttente = attendues.filter(n => !noms.has(n));
  // Le nom de la variable suit le produit ; l'ancien nom reste accepté.
  const destination = config.UNIVERSITY_BACKUP_REMOTE || config.UNIPRESENCE_BACKUP_REMOTE || '';
  const externe = /^[a-zA-Z0-9_.@-]+:\/[^\s]+$/.test(destination);
  const blocages = [];
  if (!administrateursReels) blocages.push('Aucun administrateur actif avec un mot de passe hors démonstration.');
  if (comptesDemo) blocages.push(`${comptesDemo} comptes actifs conservent un mot de passe de démonstration.`);
  if (!externe) blocages.push('Destination SSH de sauvegarde hors serveur non configurée.');
  if (enAttente.length) blocages.push(`${enAttente.length} migrations en attente : planifier leur application après sauvegarde distante et restauration vérifiées.`);
  const report = {
    date: new Date().toISOString(), lectureSeule: true,
    comptes: { actifs: users.length, demonstration: comptesDemo, administrateursReels },
    migrations: { attendues: attendues.length, appliquees: noms.size, enAttente },
    sauvegarde: { destinationSshConfiguree: externe, limite: 'Une configuration seule ne prouve pas la copie ni la restauration distantes ; vérifier les preuves avant publication.' },
    nginx,
    blocages, pretPourRevueDeploiement: !blocages.length,
  };
  const cible = process.argv[2];
  if (cible) {
    fs.mkdirSync(path.dirname(path.resolve(cible)), { recursive: true });
    fs.writeFileSync(cible, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
  if (blocages.length) process.exitCode = 1;
}
inspecter().catch(() => { console.error('Inspection impossible ; aucun déploiement autorisé par ce contrôle. Vérifiez la connexion et le schéma.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
