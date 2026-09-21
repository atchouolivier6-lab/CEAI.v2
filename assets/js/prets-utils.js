// =========================================================
// CEAI — Calcul de la pénalité de retard sur un prêt
// Règle : 1 mois de grâce après l'octroi, puis 10% du montant
// emprunté par mois de retard supplémentaire.
// =========================================================
export function calculerPenalite(montant, dateOctroiIso) {
  if (!dateOctroiIso) return { moisEcoules: 0, moisEnRetard: 0, penalite: 0 };

  const joursEcoules = (Date.now() - new Date(dateOctroiIso).getTime()) / (1000 * 60 * 60 * 24);
  const moisEcoules = Math.floor(joursEcoules / 30);
  const moisEnRetard = Math.max(0, moisEcoules - 1);
  const penalite = moisEnRetard * Number(montant) * 0.1;

  return { moisEcoules, moisEnRetard, penalite };
}
