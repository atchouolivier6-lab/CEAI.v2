// =========================================================
// CEAI — Écran "Archives de cotisation" (sessions clôturées)
// =========================================================
import { afficherArchives } from "../archives-liste.js";

export function ecranCotisationArchives(conteneur) {
  return afficherArchives(conteneur, {
    type: "cotisation",
    table: "cotisation_sessions",
    statut: "cloturee",
    debut: "ouverte_le",
    fin: "cloturee_le",
    titre: "Sessions de cotisation clôturées",
    vide: "Aucune session clôturée pour le moment.",
    libelleDebut: "Ouverte le",
    libelleFin: "Clôturée le",
    article: "la session",
  });
}
