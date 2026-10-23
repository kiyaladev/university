#!/usr/bin/env node
/** Inventaire statique des routes Nest pour préparer la revue des périmètres. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const racine = path.resolve(__dirname, '..');
const { dossierPreuves } = require('./preuves.cjs');
// La preuve part dans le dossier du jour : une preuve déjà versionnée ne doit
// pas être réécrite par un nouvel inventaire.
const sortie = process.argv[2] || path.join(dossierPreuves(), 'inventaire-routes.json');
const fichiers = [];
function parcourir(dir) {
  for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
    const chemin = path.join(dir, entree.name);
    if (entree.isDirectory()) parcourir(chemin);
    else if (entree.isFile() && entree.name.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(entree.name))
      fichiers.push(chemin);
  }
}
parcourir(path.join(racine, 'src'));

const nomDecorateur = (decorateur) => {
  const expr = ts.isCallExpression(decorateur.expression) ? decorateur.expression.expression : decorateur.expression;
  return ts.isIdentifier(expr) ? expr.text : '';
};
const decorateurs = (node) => (ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : []);
const roles = (decorators, roleConstants, names = ['Roles']) => {
  const declaration = decorators.find((d) => names.includes(nomDecorateur(d)));
  if (!declaration || !ts.isCallExpression(declaration.expression)) return null;
  const expand = (arg) => {
    if (ts.isSpreadElement(arg)) {
      const expression = arg.expression;
      return ts.isIdentifier(expression) ? roleConstants.get(expression.text) || [`...${expression.text}`] : [];
    }
    if (ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.expression) && arg.expression.text === 'Role')
      return [arg.name.text];
    if (ts.isIdentifier(arg)) return roleConstants.get(arg.text) || [arg.text];
    if (ts.isStringLiteral(arg)) return [arg.text];
    return [];
  };
  return declaration.expression.arguments.flatMap(expand);
};
const valeurRoute = (decorator) => {
  if (!ts.isCallExpression(decorator.expression) || !decorator.expression.arguments.length) return '';
  const arg = decorator.expression.arguments[0];
  return ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg) ? arg.text : '';
};
const gardes = (decorators) =>
  decorators
    .filter((d) => nomDecorateur(d) === 'UseGuards' && ts.isCallExpression(d.expression))
    .flatMap((d) =>
      d.expression.arguments.map((arg) => {
        if (ts.isIdentifier(arg)) return arg.text;
        if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) return `${arg.expression.text}(...)`;
        if (ts.isPropertyAccessExpression(arg)) return arg.getText();
        return arg.getText();
      }),
    );
const unwrap = (node) =>
  ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrap(node.expression)
    : node;

const routes = [];
const rolesMetier = new Set(['ETUDIANT', 'ENSEIGNANT', 'CHEF_DEPARTEMENT', 'CONTROLEUR']);
const controleurs = new Set();
const fichiersAvecControleur = new Set();
for (const fichier of fichiers) {
  const texte = fs.readFileSync(fichier, 'utf8');
  const source = ts.createSourceFile(fichier, texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const roleConstants = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer && unwrap(declaration.initializer);
      if (!ts.isIdentifier(declaration.name) || !initializer || !ts.isArrayLiteralExpression(initializer)) continue;
      const values = initializer.elements.flatMap((arg) => {
        if (ts.isSpreadElement(arg) && ts.isIdentifier(arg.expression))
          return roleConstants.get(arg.expression.text) || [];
        if (ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.expression) && arg.expression.text === 'Role')
          return [arg.name.text];
        return [];
      });
      roleConstants.set(declaration.name.text, values);
    }
  }
  for (const classe of source.statements.filter(ts.isClassDeclaration)) {
    const classeDecorators = decorateurs(classe);
    if (!classeDecorators.some((d) => nomDecorateur(d) === 'Controller')) continue;
    controleurs.add(`${fichier}:${classe.name?.text || 'anonymous'}`);
    fichiersAvecControleur.add(fichier);
    const prefixe = valeurRoute(
      classeDecorators.find((d) => nomDecorateur(d) === 'Controller') || {
        expression: ts.factory.createIdentifier(''),
      },
    );
    const rolesClasse = roles(classeDecorators, roleConstants);
    for (const methode of classe.members.filter(ts.isMethodDeclaration)) {
      const ds = decorateurs(methode);
      const verbe = ds.find((d) =>
        ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options'].includes(nomDecorateur(d)),
      );
      if (!verbe) continue;
      const chemin = valeurRoute(verbe);
      const rolesMethode = roles(ds, roleConstants);
      const texteMethode = methode.getText(source);
      const protectedDocument = ds.some((d) => nomDecorateur(d) === 'ProtectedDocument');
      const protectedRoles = protectedDocument ? roles(ds, roleConstants, ['ProtectedDocument']) : null;
      const documentScope =
        ds.some((d) => nomDecorateur(d) === 'DocumentScope') ||
        classeDecorators.some((d) => nomDecorateur(d) === 'DocumentScope');
      const userParam =
        methode.parameters.some((param) => /@(CurrentUser|Req|RequestUser)\s*\(/.test(param.getText(source))) ||
        /\b(?:req|request)\.user\b/.test(texteMethode);
      const serviceCalls = [...texteMethode.matchAll(/this\.(\w+)\.(\w+)\s*\(/g)].map(
        (match) => `${match[1]}.${match[2]}`,
      );
      const hasRolesMetadata = rolesMethode !== null || rolesClasse !== null || protectedRoles !== null;
      const verb = nomDecorateur(verbe).toUpperCase();
      const route = `/${[prefixe, chemin].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
      const rolesEffectifs = rolesMethode ?? rolesClasse ?? protectedRoles ?? [];
      const hasBusinessRole = rolesEffectifs.some((role) => rolesMetier.has(role));
      routes.push({
        controller: classe.name?.text || 'anonymous',
        fichier: path.relative(racine, fichier),
        verbe: verb,
        route,
        roles: rolesEffectifs,
        rolesExplicites: hasRolesMetadata,
        gardes: [...new Set([...gardes(classeDecorators), ...gardes(ds)])],
        public:
          ds.some((d) => nomDecorateur(d) === 'Public') || classeDecorators.some((d) => nomDecorateur(d) === 'Public'),
        documentProtege: protectedDocument,
        perimetreDocument: documentScope,
        parametreUtilisateur: userParam,
        appelsService: [...new Set(serviceCalls)],
        signalPerimetre: Boolean(documentScope || userParam),
        routeAvecIdentifiant: /:[^/]+/.test(route),
        rolesMetier: hasBusinessRole,
      });
    }
  }
}

const lecture = routes.filter((route) => route.verbe === 'GET');
const raisonsRevue = (route) => {
  const raisons = [];
  if (!route.public && !route.rolesExplicites) raisons.push('aucun rôle déclaré sur la route/classe/document');
  if (!route.public && route.rolesMetier && !route.signalPerimetre)
    raisons.push('rôle métier sans contexte utilisateur ni DocumentScope détecté');
  if (!route.public && route.routeAvecIdentifiant && !route.signalPerimetre)
    raisons.push('route avec identifiant sans contexte utilisateur ni DocumentScope détecté');
  return raisons;
};
const candidats = lecture
  .map((route) => ({ ...route, raisonsRevue: raisonsRevue(route) }))
  .filter((route) => route.raisonsRevue.length > 0);
const rapport = {
  date: new Date().toISOString(),
  methode:
    'Inventaire AST des routes Nest. Les rôles de ProtectedDocument, gardes, contexte utilisateur, identifiants de route et appels this.<service>.<méthode> sont signalés. Le scanner ne suit pas les périmètres à l’intérieur des services ; les candidats doivent être revus et ne signifient pas à eux seuls une vulnérabilité.',
  fichiersParcourus: fichiers.length,
  fichiersControleurs: fichiersAvecControleur.size,
  classesControleur: controleurs.size,
  routes: routes.length,
  lectures: lecture.length,
  candidatsLectureSansUtilisateurExplicite: candidats.filter(
    (route) => route.rolesMetier && !route.parametreUtilisateur && !route.perimetreDocument,
  ).length,
  lecturesSansRolesExplicites: lecture.filter((route) => !route.public && !route.rolesExplicites).length,
  lecturesAvecIdentifiantSansSignalDePerimetre: lecture.filter(
    (route) => !route.public && route.routeAvecIdentifiant && !route.signalPerimetre,
  ).length,
  candidats,
  routesCompletes: routes,
};
fs.writeFileSync(sortie, JSON.stringify(rapport, null, 2));
console.log(
  JSON.stringify({
    fichiersControleurs: rapport.fichiersControleurs,
    classesControleur: rapport.classesControleur,
    routes: rapport.routes,
    lectures: rapport.lectures,
    candidatsSansContexte: rapport.candidatsLectureSansUtilisateurExplicite,
    routesARevoir: rapport.candidats.length,
    lecturesSansRolesExplicites: rapport.lecturesSansRolesExplicites,
    lecturesAvecIdentifiantSansSignalDePerimetre: rapport.lecturesAvecIdentifiantSansSignalDePerimetre,
    sortie,
  }),
);
