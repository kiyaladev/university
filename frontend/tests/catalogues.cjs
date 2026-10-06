const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src/i18n');
const loaded = new Map();
function charger(file) {
  const resolved = fs.existsSync(file + '.ts') ? file + '.ts' : file;
  if (!resolved.startsWith(root + path.sep)) throw Error('Catalogue hors répertoire');
  if (loaded.has(resolved)) return loaded.get(resolved).exports;
  const module = { exports: {} }; loaded.set(resolved, module);
  const js = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', js)(name => charger(path.resolve(path.dirname(resolved), name)), module, module.exports);
  return module.exports;
}
function aplatir(value, prefix = '', result = {}) {
  for (const [key, text] of Object.entries(value)) {
    const current = prefix ? `${prefix}.${key}` : key;
    if (typeof text === 'string') result[current] = text;
    else if (text && typeof text === 'object') aplatir(text, current, result);
  }
  return result;
}
const messages = charger(path.join(root, 'index.ts')).default;
const fr = aplatir(messages['fr-FR']);
const en = aplatir(messages['en-US']);
const missingEnglish = Object.keys(fr).filter(key => !(key in en));
const missingFrench = Object.keys(en).filter(key => !(key in fr));
const html = [fr, en].map(locale => Object.entries(locale).filter(([,value]) => /<\/?[a-z][^>]*>/i.test(value)).map(([key]) => key));
const stubs = Object.keys(fr).filter(key => key.endsWith('._stub'));
const report = { date: new Date().toISOString(), frenchKeys: Object.keys(fr).length, englishKeys: Object.keys(en).length, missingEnglish, missingFrench, html, stubs };
module.exports = { fr, en };
if (require.main === module) {
  fs.writeFileSync(process.argv[2] || '/tmp/university-catalogues.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (missingEnglish.length || missingFrench.length || html.some(keys => keys.length)) process.exitCode = 1;
}
