import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { DOCUMENT_ACCESS_KEY, DOCUMENT_SCOPE_KEY, ROLES_KEY } from './decorators';

const RACINE_MODULES = path.resolve(__dirname, '../modules');

function fichiersTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entree) => {
    const absolu = path.join(dir, entree.name);
    if (entree.isDirectory()) return fichiersTs(absolu);
    return entree.isFile() && entree.name.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(entree.name) ? [absolu] : [];
  });
}

function estDecorateur(noeud: ts.Decorator, nom: string): boolean {
  const expression = ts.isCallExpression(noeud.expression) ? noeud.expression.expression : noeud.expression;
  return ts.isIdentifier(expression) && expression.text === nom;
}

describe('métadonnées des routes imprimables protégées', () => {
  it('conserve authentification et rôles sur chaque vraie méthode ProtectedDocument', async () => {
    const routes: Array<{ fichier: string; classe: string; methode: string; scoped: boolean }> = [];

    for (const fichier of fichiersTs(RACINE_MODULES)) {
      const source = ts.createSourceFile(fichier, fs.readFileSync(fichier, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const declaration of source.statements.filter(ts.isClassDeclaration)) {
        for (const membre of declaration.members.filter(ts.isMethodDeclaration)) {
          const decorateurs = ts.canHaveDecorators(membre) ? (ts.getDecorators(membre) ?? []) : [];
          if (!decorateurs.some((decorateur) => estDecorateur(decorateur, 'ProtectedDocument'))) continue;
          if (!declaration.name || !ts.isIdentifier(membre.name)) continue;
          routes.push({
            fichier,
            classe: declaration.name.text,
            methode: membre.name.text,
            scoped: decorateurs.some((decorateur) => estDecorateur(decorateur, 'DocumentScope')),
          });
        }
      }
    }

    expect(routes).toHaveLength(25);
    for (const route of routes) {
      const module = await import(route.fichier);
      const controleur = module[route.classe];
      expect(controleur).toBeDefined();
      const handler = controleur.prototype[route.methode];
      expect(Reflect.getMetadata(DOCUMENT_ACCESS_KEY, handler)).toBe(true);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(expect.arrayContaining([expect.any(String)]));
      if (route.scoped) {
        expect(Reflect.getMetadata(DOCUMENT_SCOPE_KEY, handler)).toEqual({
          model: expect.any(String),
          fields: expect.any(Object),
        });
      }
    }
  });
});
