/** Vérifie les clés littérales de traduction dans les sources et leur parité FR/EN. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
function flatten(value, prefix = '', result = {}) {
  for (const [key, text] of Object.entries(value)) {
    const current = prefix ? prefix + '.' + key : key;
    if (typeof text === 'string') result[current] = text;
    else if (text && typeof text === 'object') flatten(text, current, result);
  }
  return result;
}
function catalogue(locale) {
  const result = {};
  for (const file of fs.readdirSync(path.join(root, 'i18n', locale)).filter((name) => name.endsWith('.json'))) {
    flatten(JSON.parse(fs.readFileSync(path.join(root, 'i18n', locale, file), 'utf8')), file.slice(0, -5), result);
  }
  return result;
}
function sources(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? sources(path.join(dir, entry.name))
        : entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
          ? [path.join(dir, entry.name)]
          : [],
    );
}
const fr = catalogue('fr'),
  en = catalogue('en'),
  used = new Map();
for (const file of sources(root)) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments.length) {
      const fn = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : ts.isIdentifier(node.expression)
          ? node.expression.text
          : '';
      const first = node.arguments[0];
      if (['t', 'translate'].includes(fn) && ts.isStringLiteral(first)) {
        const positions = used.get(first.text) || [];
        positions.push(path.relative(root, file) + ':' + (ast.getLineAndCharacterOfPosition(first.pos).line + 1));
        used.set(first.text, positions);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
const missingUsed = [...used]
  .filter(([key]) => !(key in fr) || !(key in en))
  .map(([key, sources]) => ({ key, sources, fr: key in fr, en: key in en }));
const missingEnglish = Object.keys(fr).filter((key) => !(key in en)),
  missingFrench = Object.keys(en).filter((key) => !(key in fr));
const report = {
  date: new Date().toISOString(),
  usedKeys: used.size,
  frenchKeys: Object.keys(fr).length,
  englishKeys: Object.keys(en).length,
  missingUsed,
  missingEnglish,
  missingFrench,
};
fs.writeFileSync(process.argv[2] || '/tmp/university-catalogues-backend.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (missingUsed.length || missingEnglish.length || missingFrench.length) process.exitCode = 1;
