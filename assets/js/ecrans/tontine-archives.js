// =========================================================
// CEAI — Écran "Archives de tontine" (cycles clôturés)
// =========================================================
import { afficherArchives } from "../archives-liste.js";

export function ecranTontineArchives(conteneur) {
  return afficherArchives(conteneur, {
    type: "tontine",
    table: "tontine_cycles",
    statut: "cloture",
    debut: "demarre_le",
    fin: "cloture_le",
    titre: "Cycles de tontine clôturés",
    vide: "Aucun cycle clôturé pour le moment.",
    libelleDebut: "Démarré le",
    libelleFin: "Clôturé le",
    article: "le cycle",
  });
}
