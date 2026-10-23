import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';

const TAILLE_FICHIER_MAX = 5 * 1024 * 1024;
const TAILLE_DECOMPRESSEE_MAX = 16 * 1024 * 1024;
const LIGNES_MAX = 2001;
const ENTETES_IMPORT = new Set([
  'matricule', 'nom', 'lastname', 'surname', 'prenom', 'first name', 'firstname',
  'email', 'courriel', 'telephone', 'grade', 'statut', 'status', 'taux horaire', 'taux',
  'departement id', 'departementid', 'code', 'intitule', 'matiere', 'libelle', 'volume horaire',
  'volume horaire total', 'credits', 'credit', 'batiment', 'building', 'capacite',
  'places', 'affectation id', 'affectationid', 'jour', 'jour semaine', 'jour de la semaine', 'joursemaine',
  'heure debut', 'heure de debut', 'heure fin', 'heure de fin', 'heuredebut', 'heurefin', 'type', 'type cours',
  'salle id', 'salleid', 'date debut', 'date de debut', 'date fin', 'date de fin', 'datedebut', 'datefin',
]);

function normaliserEntete(entete: string): string {
  return entete.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLocaleLowerCase('fr').replace(/[_-]+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ');
}

function indexEnteteImport(lignes: string[][]): number {
  const limite = Math.min(lignes.length, 10);
  for (let index = 0; index < limite; index += 1) {
    const reconnus = lignes[index].filter((valeur) => {
      const cle = normaliserEntete(valeur ?? '');
      return ENTETES_IMPORT.has(cle) || ENTETES_IMPORT.has(cle.replace(/\s/g, ''));
    }).length;
    if (reconnus >= 2) return index;
  }
  return -1;
}

function verifierArchive(donnees: Uint8Array): void {
  const vue = new DataView(donnees.buffer, donnees.byteOffset, donnees.byteLength);
  const debutRecherche = Math.max(0, donnees.length - 65_557);
  let eocd = -1;
  for (let i = donnees.length - 22; i >= debutRecherche; i -= 1) {
    if (vue.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Le fichier ne contient pas une archive XLSX valide.');
  if (vue.getUint16(eocd + 4, true) !== 0 || vue.getUint16(eocd + 6, true) !== 0) {
    throw new Error('Les classeurs répartis sur plusieurs volumes ne sont pas pris en charge.');
  }
  const nombreEntrees = vue.getUint16(eocd + 10, true);
  const tailleCentrale = vue.getUint32(eocd + 12, true);
  const offsetCentral = vue.getUint32(eocd + 16, true);
  if (nombreEntrees === 0xffff || tailleCentrale === 0xffffffff || offsetCentral === 0xffffffff) {
    throw new Error('Le format ZIP64 de ce classeur n’est pas pris en charge.');
  }
  if (nombreEntrees === 0 || nombreEntrees > 2000 || offsetCentral + tailleCentrale > eocd) {
    throw new Error('Le répertoire du classeur est invalide ou trop volumineux.');
  }
  const finCentral = offsetCentral + tailleCentrale;
  let position = offsetCentral;
  let tailleTotale = 0;
  for (let i = 0; i < nombreEntrees; i += 1) {
    if (position + 46 > finCentral || vue.getUint32(position, true) !== 0x02014b50) {
      throw new Error('Le répertoire du classeur est endommagé.');
    }
    const drapeaux = vue.getUint16(position + 8, true);
    const compresse = vue.getUint32(position + 20, true);
    const decompresse = vue.getUint32(position + 24, true);
    const nom = vue.getUint16(position + 28, true);
    const extra = vue.getUint16(position + 30, true);
    const commentaire = vue.getUint16(position + 32, true);
    if (drapeaux & 1) throw new Error('Les classeurs chiffrés par mot de passe ne sont pas pris en charge.');
    if (compresse === 0xffffffff || decompresse === 0xffffffff) {
      throw new Error('Les classeurs ZIP64 ne sont pas pris en charge.');
    }
    tailleTotale += decompresse;
    if (decompresse > 8 * 1024 * 1024 || tailleTotale > TAILLE_DECOMPRESSEE_MAX) {
      throw new Error('Le contenu décompressé du classeur dépasse la limite autorisée de 16 Mo.');
    }
    position += 46 + nom + extra + commentaire;
  }
  if (position !== finCentral) throw new Error('Le répertoire du classeur est incohérent.');
}

async function extraireXml(donnees: Uint8Array): Promise<Record<string, string>> {
  const fichiers: Record<string, string> = {};
  let tailleSortie = 0;
  return new Promise((resolve, reject) => {
    const unzip = new Unzip((fichier) => {
      const nom = fichier.name;
      if (![
        'xl/sharedStrings.xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
      ].includes(nom) && !/^xl\/worksheets\/sheet\d+\.xml$/.test(nom)) return;
      const morceaux: Uint8Array[] = [];
      fichier.ondata = (erreur, bloc, fin) => {
        if (erreur) { reject(erreur); return; }
        tailleSortie += bloc.length;
        if (tailleSortie > TAILLE_DECOMPRESSEE_MAX) {
          reject(new Error('Le classeur dépasse la limite de décompression autorisée.'));
          return;
        }
        morceaux.push(bloc);
        if (fin) {
          const longueur = morceaux.reduce((somme, morceau) => somme + morceau.length, 0);
          const xml = new Uint8Array(longueur);
          let offset = 0;
          for (const morceau of morceaux) { xml.set(morceau, offset); offset += morceau.length; }
          fichiers[nom] = new TextDecoder('utf-8', { fatal: true }).decode(xml);
        }
      };
      fichier.start();
    });
    unzip.register(UnzipPassThrough);
    unzip.register(UnzipInflate);
    try {
      unzip.push(donnees, true);
      resolve(fichiers);
    } catch (erreur) { reject(erreur); }
  });
}

function documentXml(xml: string, nom: string): XMLDocument {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error(`Le fichier XLSX contient un XML invalide (${nom}).`);
  return document;
}

function elements(parent: Document | Element, nom: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', nom));
}

function premierFeuillet(fichiers: Record<string, string>): string {
  if (!fichiers['xl/workbook.xml'] || !fichiers['xl/_rels/workbook.xml.rels']) return 'xl/worksheets/sheet1.xml';
  const workbook = documentXml(fichiers['xl/workbook.xml'], 'workbook.xml');
  const relationId = elements(workbook, 'sheet')[0]?.getAttributeNS(
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id',
  );
  const relations = documentXml(fichiers['xl/_rels/workbook.xml.rels'], 'workbook.xml.rels');
  const relation = elements(relations, 'Relationship').find((e) => e.getAttribute('Id') === relationId);
  const cible = relation?.getAttribute('Target')?.replace(/^\//, '');
  const chemin = cible?.startsWith('xl/') ? cible : cible ? `xl/${cible}` : '';
  if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(chemin)) {
    throw new Error('La première feuille du classeur ne peut pas être lue.');
  }
  return chemin;
}

function chainePartagee(document: XMLDocument): string[] {
  return elements(document, 'si').map((item) => elements(item, 't').map((t) => t.textContent ?? '').join(''));
}

function colonneIndex(reference: string): number {
  const lettres = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!lettres) return -1;
  let index = 0;
  for (const lettre of lettres) index = index * 26 + lettre.charCodeAt(0) - 64;
  return index - 1;
}

function csvValeur(valeur: string): string {
  return /[;"\r\n]/.test(valeur) ? `"${valeur.replace(/"/g, '""')}"` : valeur;
}

/** Convertit la première feuille XLSX en CSV avec des limites anti-archive-bombe. */
export async function convertirXlsxEnCsv(fichier: File): Promise<string> {
  if (fichier.size === 0 || fichier.size > TAILLE_FICHIER_MAX) {
    throw new Error('Le fichier XLSX doit peser moins de 5 Mo.');
  }
  const donnees = new Uint8Array(await fichier.arrayBuffer());
  verifierArchive(donnees);
  const fichiers = await extraireXml(donnees);
  const chemin = premierFeuillet(fichiers);
  const xml = fichiers[chemin];
  if (!xml) throw new Error('Aucune première feuille lisible n’a été trouvée dans ce classeur.');
  const feuille = documentXml(xml, 'première feuille');
  const partagees = fichiers['xl/sharedStrings.xml']
    ? chainePartagee(documentXml(fichiers['xl/sharedStrings.xml'], 'sharedStrings.xml'))
    : [];
  const lignes = elements(feuille, 'row');
  const valeursLignes = lignes.map((ligne) => {
    const cellules: string[] = [];
    let prochaineColonne = 0;
    for (const cellule of elements(ligne, 'c')) {
      const reference = cellule.getAttribute('r');
      const index = reference ? colonneIndex(reference) : prochaineColonne;
      if (index < 0 || index > 100) throw new Error('Une feuille contient une colonne invalide ou trop éloignée.');
      prochaineColonne = index + 1;
      const type = cellule.getAttribute('t');
      let valeur = '';
      if (type === 'inlineStr') valeur = elements(cellule, 't').map((t) => t.textContent ?? '').join('');
      else {
        const brut = elements(cellule, 'v')[0]?.textContent ?? '';
        valeur = type === 's' ? partagees[Number(brut)] ?? '' : brut;
      }
      cellules[index] = valeur;
    }
    return cellules;
  });
  const indexEntetes = indexEnteteImport(valeursLignes);
  if (indexEntetes < 0) throw new Error('Aucune ligne d’en-tête reconnue dans les dix premières lignes de la feuille.');
  if (lignes.length - indexEntetes > LIGNES_MAX) throw new Error('Un classeur peut contenir au maximum 2 000 lignes de données.');
  const entetes = valeursLignes[indexEntetes] ?? [];
  const colonnesDate = new Set(entetes.flatMap((entete, i) => {
    const cle = normaliserEntete(entete ?? '');
    return ['date debut', 'date de debut', 'date fin', 'date de fin', 'datedebut', 'datefin'].includes(cle.replace(/\s/g, ''))
      || ['date debut', 'date de debut', 'date fin', 'date de fin'].includes(cle) ? [i] : [];
  }));
  const colonnesHeure = new Set(entetes.flatMap((entete, i) => {
    const cle = normaliserEntete(entete ?? '');
    return [
      'heure debut', 'heure de debut', 'heure debut du cours', 'heure de debut du cours',
      'heure fin', 'heure de fin', 'heure fin du cours', 'heure de fin du cours',
      'heuredebut', 'heurefin', 'heuredebutcours', 'heurefincours',
      'debut', 'fin', 'debutcours', 'fincours', 'starttime', 'endtime',
    ].includes(cle.replace(/\s/g, ''))
      || ['heure debut', 'heure de debut', 'heure debut du cours', 'heure de debut du cours',
        'heure fin', 'heure de fin', 'heure fin du cours', 'heure de fin du cours'].includes(cle) ? [i] : [];
  }));
  const origineExcel = Date.UTC(1899, 11, 30);
  const contenu = valeursLignes.slice(indexEntetes).map((ligne, index) => {
    if (index === 0) return ligne.map((v) => csvValeur(v ?? '')).join(';');
    return entetes.map((_, colonne) => {
      let valeur = ligne[colonne] ?? '';
      if (colonnesDate.has(colonne) && /^\d+(?:\.\d+)?$/.test(valeur)) {
        const date = new Date(origineExcel + Number(valeur) * 86_400_000);
        valeur = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      }
      if (colonnesHeure.has(colonne) && /^(?:0(?:\.\d+)?|0?\.\d+)$/.test(valeur)) {
        const minutes = Math.min(1439, Math.round(Number(valeur) * 1440));
        valeur = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      }
      return csvValeur(valeur);
    }).join(';');
  }).join('\r\n');
  return `${'\r\n'.repeat(indexEntetes)}${contenu}`;
}
