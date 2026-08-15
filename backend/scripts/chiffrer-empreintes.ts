/**
 * Reprise des gabarits d'empreinte restés en clair.
 *
 *     bunx ts-node scripts/chiffrer-empreintes.ts          (compte et chiffre)
 *     bunx ts-node scripts/chiffrer-empreintes.ts --verifier  (contrôle seul)
 *
 * Le script est rejouable : un gabarit déjà chiffré est laissé tel quel.
 * À lancer une fois la clé BIOMETRIE_CHIFFREMENT_CLE en place, et après une
 * sauvegarde — un chiffrement avec une clé qu'on perd ensuite est une perte
 * de données définitive.
 */
import { PrismaClient } from '@prisma/client';
import { chiffrer, dechiffrer, estChiffre } from '../src/common/coffre';

const prisma = new PrismaClient();
const verifierSeulement = process.argv.includes('--verifier');

async function main() {
  const enseignants = await prisma.enseignant.findMany({
    where: { empreinteTemplate: { not: null } },
    select: { id: true, matricule: true, empreinteTemplate: true },
  });

  const enClair = enseignants.filter((e) => !estChiffre(e.empreinteTemplate!));
  console.log(
    `${enseignants.length} gabarit(s) en base — ${enClair.length} en clair, ` +
      `${enseignants.length - enClair.length} déjà chiffré(s).`,
  );

  if (verifierSeulement) {
    // Un chiffré illisible est pire qu'un clair : on le détecte maintenant.
    let illisibles = 0;
    for (const e of enseignants.filter((x) => estChiffre(x.empreinteTemplate!))) {
      try {
        dechiffrer(e.empreinteTemplate!);
      } catch {
        illisibles++;
        console.error(`  ✗ ${e.matricule} : déchiffrement impossible`);
      }
    }
    console.log(illisibles ? `${illisibles} gabarit(s) illisible(s)` : 'Tous déchiffrables.');
    return;
  }

  for (const e of enClair) {
    await prisma.enseignant.update({
      where: { id: e.id },
      data: { empreinteTemplate: chiffrer(e.empreinteTemplate!) },
    });
    console.log(`  ✓ ${e.matricule}`);
  }
  console.log(`${enClair.length} gabarit(s) chiffré(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
