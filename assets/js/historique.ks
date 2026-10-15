// =========================================================
// CEAI — Bouton "retour" du téléphone et fenêtres ouvertes
//
// Quand une fenêtre est ouverte (partage, agents, installation), le
// bouton retour la ferme au lieu de quitter l'écran. Dans une
// discussion avec un agent, il revient d'abord à la liste des agents.
// La fenêtre du tirage au sort, elle, reste en place : on la ferme
// avec ses boutons.
// =========================================================
const FENETRES = ".partage-voile, .agents-voile, .installation-voile, .tirage-voile";

let fenetre = null;
let retourProvoque = false;

const marquer = () => history.pushState({ ceaiFenetre: true }, "");

// Renvoie sans fermer si la fenêtre doit rester (tirage au sort, discussion)
function reagirAuRetour(f) {
  if (f.classList.contains("tirage-voile")) {
    marquer(); // la fenêtre reste ; on remet une entrée pour le prochain retour
    return;
  }

  const retourListe = f.querySelector(".discussion-retour");
  if (retourListe) {
    retourListe.click(); // de la discussion vers la liste des agents
    marquer();
    return;
  }

  const fermer = f.querySelector(".partage-fermer, .agents-fermer");
  if (fermer) fermer.click();
  else f.remove();
}

export function initialiserHistorique() {
  new MutationObserver(() => {
    const ouverte = document.querySelector(FENETRES);

    if (ouverte && !fenetre) {
      fenetre = ouverte;
      marquer(); // une entrée d'historique pour la fenêtre : le retour la ferme
    } else if (!ouverte && fenetre) {
      fenetre = null;
      // Fermée avec ses propres boutons : on retire l'entrée ajoutée à l'ouverture
      if (history.state && history.state.ceaiFenetre) {
        retourProvoque = true;
        history.back();
      }
    }
  }).observe(document.body, { childList: true });

  window.addEventListener("popstate", () => {
    if (retourProvoque) {
      retourProvoque = false;
      return;
    }
    if (fenetre) reagirAuRetour(fenetre);
  });
}
