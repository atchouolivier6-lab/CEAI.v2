// =========================================================
// CEAI — Bouton retour du téléphone pour les fenêtres
// Une fenêtre (feuille, formulaire...) qui s'ouvre ajoute une entrée
// dans l'historique : le bouton retour du téléphone la ferme alors
// au lieu de quitter la page. Si plusieurs fenêtres sont ouvertes,
// seule la dernière ouverte se ferme.
//
// Utilisation :
//   const detacher = lierRetour(nettoyer);   // à l'ouverture
//   ... et à la fermeture par un bouton : detacher(); nettoyer();
// =========================================================
const pile = [];
let retoursAIgnorer = 0;

window.addEventListener("popstate", () => {
  if (retoursAIgnorer > 0) {
    retoursAIgnorer -= 1;
    return;
  }
  const haut = pile.pop();
  if (haut) haut.fermer();
});

export function lierRetour(fermer) {
  const element = { fermer };
  pile.push(element);
  history.pushState({ ceaiFenetre: true }, "");

  return function detacher() {
    const index = pile.indexOf(element);
    if (index === -1) return; // déjà fermée par le bouton retour
    pile.splice(index, 1);
    retoursAIgnorer += 1;
    history.back();
  };
}
