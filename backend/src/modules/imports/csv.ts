export interface LigneCsv {
  numero: number;
  donnees: Record<string, string>;
}

export interface ResultatCsv {
  entetes: Array<string | undefined>;
  colonnesIgnorees: string[];
  lignes: LigneCsv[];
  erreurs: string[];
}

export const COLONNES: Record<string, string[]> = {
  matricule: ['matricule', 'matricule enseignant', 'id enseignant'],
  nom: ['nom', 'nom enseignant', 'nom de l’enseignant', "nom de l'enseignant", 'lastname', 'surname'],
  prenom: ['prenom', 'first name', 'firstname', 'prénom', 'prenom enseignant', 'prénom enseignant', 'prenom de l’enseignant', "prenom de l'enseignant"],
  email: ['email', 'courriel', 'e-mail'],
  telephone: ['telephone', 'téléphone', 'tel', 'phone'],
  grade: ['grade', 'titre', 'fonction'],
  statut: ['statut', 'status'],
  tauxHoraire: ['taux horaire', 'tauxhoraire', 'taux'],
  departementId: ['departement id', 'departementid', 'id departement'],
  actif: ['actif', 'active', 'enabled'],
  code: ['code', 'code matiere', 'code salle'],
  intitule: ['intitule', 'intitulé', 'intitule de la matiere', 'intitulé de la matière', 'matiere', 'matière', 'libelle', 'libellé'],
  volumeHoraireTotal: ['volume horaire', 'volume horaire total', 'volumehorairetotal', 'volume horaire (h)'],
  credits: ['credits', 'crédits', 'credit'],
  batiment: ['batiment', 'bâtiment', 'building'],
  capacite: ['capacite', 'capacité', 'places', 'nombre de places', 'capacite de la salle', 'capacité de la salle'],
  affectationId: ['affectation id', 'affectationid', 'id affectation'],
  jourSemaine: ['jour', 'jour semaine', 'jour de la semaine', 'joursemaine', 'day', 'day of week'],
  heureDebut: ['heure debut', 'heure début', 'heure de debut', 'heure de début', 'heuredebut', 'heure de debut du cours', 'heure de début du cours', 'heure debut cours', 'debut cours', 'debut', 'début', 'start time'],
  heureFin: ['heure fin', 'heure de fin', 'heurefin', 'heure de fin du cours', 'heure fin cours', 'fin cours', 'fin', 'end time'],
  type: ['type', 'type cours', 'type de cours', 'typecours'],
  salleId: ['salle id', 'salleid', 'id salle'],
  dateDebut: ['date debut', 'date début', 'date de debut', 'date de début', 'datedebut'],
  dateFin: ['date fin', 'date de fin', 'datefin'],
};

function normaliserCleEntete(entete: string): string {
  return entete
    .replace(/^\uFEFF/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLocaleLowerCase('fr').replace(/[_-]+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ');
}

export function normaliserEntete(entete: string): string | undefined {
  const cle = normaliserCleEntete(entete);
  return Object.entries(COLONNES).find(([, alias]) => alias.some((a) => normaliserCleEntete(a) === cle))?.[0];
}

function decouperLigne(ligne: string, separateur: string): string[] {
  const cellules: string[] = [];
  let champ = '';
  let guillemets = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const caractere = ligne[i];
    if (caractere === '"') {
      if (guillemets && ligne[i + 1] === '"') { champ += '"'; i += 1; }
      else if (guillemets || champ.length === 0) guillemets = !guillemets;
      else champ += caractere;
    } else if (!guillemets && caractere === separateur) {
      cellules.push(champ); champ = '';
    } else champ += caractere;
  }
  cellules.push(champ);
  return cellules;
}

function separateurEntete(contenu: string): { separateur: string; ligneEntete: number | null } {
  const lignes = contenu.split(/\r\n|\n|\r/).slice(0, 10);
  let repli: { separateur: string; ligne: number; difference: number } | null = null;
  let meilleureEntete: { separateur: string; ligne: number; score: number; colonnes: number } | null = null;
  for (let index = 0; index < lignes.length; index += 1) {
    const brut = lignes[index];
    if (!brut.trim()) continue;
    const pointVirgule = decouperLigne(brut, ';');
    const virgule = decouperLigne(brut, ',');
    const nbPointVirgule = pointVirgule.length - 1;
    const nbVirgule = virgule.length - 1;
    if (!repli && (nbPointVirgule || nbVirgule)) {
      repli = {
        separateur: nbPointVirgule >= nbVirgule ? ';' : ',',
        ligne: index + 1,
        difference: Math.abs(nbPointVirgule - nbVirgule),
      };
    }
    for (const [separateur, cellules] of [[';', pointVirgule], [',', virgule]] as const) {
      const score = cellules.filter((cellule) => normaliserEntete(cellule) !== undefined).length;
      if (score < 2) continue;
      if (!meilleureEntete || score > meilleureEntete.score
        || (score === meilleureEntete.score && cellules.length > meilleureEntete.colonnes)) {
        meilleureEntete = { separateur, ligne: index + 1, score, colonnes: cellules.length };
      }
    }
  }
  if (meilleureEntete) return { separateur: meilleureEntete.separateur, ligneEntete: meilleureEntete.ligne };
  return { separateur: repli?.separateur ?? ';', ligneEntete: null };
}

/** Lit le dialecte CSV courant des exports francophones, y compris les champs multilignes. */
export function lireCsv(contenuBrut: string): ResultatCsv {
  const contenu = contenuBrut.replace(/^\uFEFF/, '');
  const { separateur, ligneEntete } = separateurEntete(contenu);
  const table: Array<{ valeurs: string[]; ligne: number }> = [];
  let valeurs: string[] = [];
  let champ = '';
  let guillemets = false;
  let ligne = 1;
  let debutLigne = 1;

  for (let i = 0; i < contenu.length; i += 1) {
    const caractere = contenu[i];
    if (caractere === '"') {
      if (guillemets && contenu[i + 1] === '"') { champ += '"'; i += 1; }
      else if (guillemets || champ.length === 0) guillemets = !guillemets;
      else champ += caractere;
    } else if (!guillemets && caractere === separateur) {
      valeurs.push(champ); champ = '';
    } else if (!guillemets && (caractere === '\n' || caractere === '\r')) {
      if (caractere === '\r' && contenu[i + 1] === '\n') i += 1;
      valeurs.push(champ); champ = '';
      if (valeurs.some((v) => v.trim() !== '')) table.push({ valeurs, ligne: debutLigne });
      valeurs = [];
      ligne += 1;
      debutLigne = ligne;
    } else {
      champ += caractere;
      if (caractere === '\n') ligne += 1;
    }
  }
  if (guillemets) return { entetes: [], colonnesIgnorees: [], lignes: [], erreurs: [`Guillemets CSV non refermés près de la ligne ${ligne}.`] };
  if (champ.length || valeurs.length) {
    valeurs.push(champ);
    if (valeurs.some((v) => v.trim() !== '')) table.push({ valeurs, ligne: debutLigne });
  }
  if (!table.length) return { entetes: [], colonnesIgnorees: [], lignes: [], erreurs: ['Le fichier est vide.'] };

  const indexEnteteTable = ligneEntete === null ? 0 : Math.max(0, table.findIndex((row) => row.ligne === ligneEntete));
  const entete = table[indexEnteteTable];
  const entetesBrutes = entete.valeurs;
  const entetes = entetesBrutes.map(normaliserEntete);
  const colonnesIgnorees = entetes.flatMap((entete, index) =>
    entete || !entetesBrutes[index]?.trim() ? [] : [entetesBrutes[index].trim()],
  );
  const colonnesDupliquees = new Set<string>();
  const vues = new Set<string>();
  for (const entete of entetes) {
    if (entete && vues.has(entete)) colonnesDupliquees.add(entete);
    if (entete) vues.add(entete);
  }
  const erreurs = colonnesDupliquees.size
    ? [`Colonnes en double après normalisation : ${[...colonnesDupliquees].join(', ')}.`]
    : [];
  const lignes = table.slice(indexEnteteTable + 1).map(({ valeurs: cellules, ligne: numero }) => {
    const donnees: Record<string, string> = {};
    entetes.forEach((entete, index) => {
      if (entete) donnees[entete] = (cellules[index] ?? '').trim();
    });
    return { numero, donnees };
  });
  return { entetes, colonnesIgnorees, lignes, erreurs };
}
