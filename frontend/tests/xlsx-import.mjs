/** Test du décodeur XLSX dans Chromium ; lancer avec le serveur Quasar démarré. */
import { chromium } from 'playwright';
import { zipSync } from 'fflate';

const base = process.argv[2] ?? 'http://localhost:5044';
const enc = new TextEncoder();
const xml = (value) => enc.encode(value);
const workbook = zipSync({
  'xl/workbook.xml': xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Import" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels': xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/></Relationships>'),
  'xl/sharedStrings.xml': xml('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Matricule</t></si><si><t>Nom</t></si><si><t>Prénom</t></si><si><t>Taux horaire</t></si><si><t>heureDebut</t></si><si><t>heureFin</t></si><si><t>T-01</t></si><si><t>Diallo &amp; Camara</t></si><si><t>Awa</t></si><si><t>Planning 2026</t></si><si><t>dateDebut</t></si><si><t>dateFin</t></si></sst>'),
  'xl/worksheets/sheet1.xml': xml('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>9</v></c></row><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="C2" t="s"><v>2</v></c><c r="D2" t="s"><v>3</v></c><c r="E2" t="s"><v>4</v></c><c r="F2" t="s"><v>5</v></c><c r="G2" t="s"><v>10</v></c><c r="H2" t="s"><v>11</v></c></row><row r="3"><c r="A3" t="s"><v>6</v></c><c r="B3" t="s"><v>7</v></c><c r="C3" t="s"><v>8</v></c><c r="D3"><v>1250.5</v></c><c r="E3"><v>0.3541666667</v></c><c r="F3"><v>0.4166666667</v></c><c r="G3"><v>46300</v></c><c r="H3"><v>46315</v></c></row></sheetData></worksheet>'),
});
const zip64Signal = new Uint8Array(workbook);
let centralHeader = -1;
for (let i = 0; i < zip64Signal.length - 4; i += 1) {
  if (zip64Signal[i] === 0x50 && zip64Signal[i + 1] === 0x4b && zip64Signal[i + 2] === 0x01 && zip64Signal[i + 3] === 0x02) {
    centralHeader = i;
    break;
  }
}
if (centralHeader < 0) throw new Error('Archive fixture sans entrée centrale.');
new DataView(zip64Signal.buffer).setUint32(centralHeader + 24, 0xffffffff, true);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${base}/#/connexion`, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async ({ base64, malformed }) => {
    const decoder = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    const { convertirXlsxEnCsv } = await import('/src/utils/xlsx.ts');
    const { decoderCsv } = await import('/src/utils/csv.ts');
    const csv = await convertirXlsxEnCsv(new File([decoder(base64)], 'modele.xlsx'));
    const utf8 = decoderCsv(new TextEncoder().encode('Prénom;Nom\r\n'));
    const legacy = decoderCsv(new Uint8Array([0x50, 0x72, 0xe9, 0x6e, 0x6f, 0x6d, 0x3b, 0x4e, 0x6f, 0x6d]));
    let refusZip64 = false;
    try {
      await convertirXlsxEnCsv(new File([decoder(malformed)], 'malforme.xlsx'));
    } catch (error) {
      refusZip64 = String(error).includes('ZIP64');
    }
    return { csv, utf8, legacy, refusZip64 };
  }, {
    base64: Buffer.from(workbook).toString('base64'),
    malformed: Buffer.from(zip64Signal).toString('base64'),
  });
  const attendu = '\r\nMatricule;Nom;Prénom;Taux horaire;heureDebut;heureFin;dateDebut;dateFin\r\nT-01;Diallo & Camara;Awa;1250.5;08:30;10:00;2026-10-05;2026-10-20';
  if (result.csv !== attendu) throw new Error(`Conversion incorrecte : ${JSON.stringify(result.csv)}`);
  if (result.utf8 !== 'Prénom;Nom\r\n' || result.legacy !== 'Prénom;Nom') {
    throw new Error(`Décodage CSV incorrect : ${JSON.stringify({ utf8: result.utf8, legacy: result.legacy })}`);
  }
  if (!result.refusZip64) throw new Error('Le classeur ZIP64 invalide n’a pas été refusé.');
  console.log('XLSX → CSV, ligne titre, modèle camelCase, dates/heures Excel, UTF-8/Windows-1252 et refus ZIP64 : OK');
} finally {
  await browser.close();
}
