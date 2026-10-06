import { defineBoot } from '#q-app/wrappers';

let prochainIdTitre = 1;

/** Relie les dialogues Quasar à leur titre visible quand aucun libellé n'est fourni. */
function nommerDialogues(racine: ParentNode) {
  const dialogues = racine instanceof Element && racine.matches('[role="dialog"], [role="alertdialog"]')
    ? [racine]
    : Array.from(racine.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'));
  for (const dialogue of dialogues) {
    if (dialogue.hasAttribute('aria-label') || dialogue.hasAttribute('aria-labelledby')) continue;
    const titre = dialogue.querySelector<HTMLElement>('h1, h2, h3, [role="heading"], .text-h6, .text-subtitle1');
    if (!titre?.textContent?.trim()) continue;
    if (!titre.id) {
      let id = `unipresence-dialogue-titre-${prochainIdTitre++}`;
      while (document.getElementById(id)) id = `unipresence-dialogue-titre-${prochainIdTitre++}`;
      titre.id = id;
    }
    dialogue.setAttribute('aria-labelledby', titre.id);
  }
}

/** Maintient Tab dans le dialogue supérieur, y compris lorsqu'il n'a qu'un bouton. */
export default defineBoot(() => {
  nommerDialogues(document);
  const observateur = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Certains dialogues remplissent leur titre après l'ouverture. Vue peut
      // alors ajouter uniquement un nœud texte, sans nouvel élément à inspecter.
      const cible = mutation.target instanceof Element
        ? mutation.target
        : mutation.target.parentElement;
      const dialogueCible = cible?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]');
      if (dialogueCible) nommerDialogues(dialogueCible);

      for (const noeud of mutation.addedNodes) {
        if (noeud instanceof Element) nommerDialogues(noeud);
        const parent = noeud instanceof Element ? noeud : noeud.parentElement;
        const dialogue = parent?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]');
        if (dialogue) nommerDialogues(dialogue);
      }
    }
  });
  observateur.observe(document.body, { childList: true, subtree: true, characterData: true });

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('.q-dialog__inner'))
      .filter(element => element.getClientRects().length > 0);
    const dialog = dialogs.at(-1);
    if (!dialog) return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled, [aria-disabled="true"]')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
    const first = controls[0];
    const last = controls.at(-1);
    const active = document.activeElement;
    if (!first) {
      event.preventDefault();
      dialog.focus();
    } else if (!dialog.contains(active) || (event.shiftKey ? active === first : active === last)
      || active === dialog && event.shiftKey) {
      event.preventDefault();
      (event.shiftKey ? last! : first).focus();
    }
  }, true);
});
