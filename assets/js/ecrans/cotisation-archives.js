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
    videMembre: "Vous n'avez participé à aucune session clôturée.",
    participation: [
      ["cotisation_adhesions", "session_id"],
      ["cotisation_versements", "session_id"],
    ],
    libelleDebut: "Ouverte le",
    libelleFin: "Clôturée le",
    article: "la session",
  });
}
