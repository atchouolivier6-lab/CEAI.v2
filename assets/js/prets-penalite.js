// =========================================================
// CEAI — Pénalité des prêts (calcul au jour le jour)
//
// Règle :
//  - le décompte démarre dès la date du prêt (aucun mois de grâce) ;
//  - la pénalité de 10 % du montant emprunté, par mois, se compte jour par
//    jour : un mois = 30 jours, donc chaque jour écoulé ajoute 1/30e des
//    10 % ; au bout de 30 jours, les 10 % du premier mois sont atteints,
//    puis le mois suivant continue de la même façon, et ainsi de suite.
//
// Pour changer le taux ou remettre un mois de grâce (MOIS_DE_GRACE = 1),
// modifiez seulement les 3 lignes ci-dessous.
// =========================================================
export const TAUX_PENALITE_MENSUEL = 0.1;
export const MOIS_DE_GRACE = 0;
export const JOURS_PAR_MOIS = 30;

// "2026-10-15" (ou date ISO complète) -> date locale à minuit
function enDate(valeur) {
  const [annee, mois, jour] = String(valeur).slice(0, 10).split("-").map(Number);
  return new Date(annee, mois - 1, jour);
}

function ajouterMois(date, nombre) {
  const cible = new Date(date.getFullYear(), date.getMonth() + nombre, 1);
  const dernierJour = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  cible.setDate(Math.min(date.getDate(), dernierJour));
  return cible;
}

// Date du jour au format AAAA-MM-JJ (heure locale)
export function dateDuJour() {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${maintenant.getFullYear()}-${mois}-${jour}`;
}

// "2026-10-15" -> "15 oct. 2026" (sans décalage de fuseau horaire)
export function formaterJour(valeur) {
  if (!valeur) return "—";
  return enDate(valeur).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// Renvoie { joursEnRetard, moisEnRetard, penalite, finGrace }
export function calculerPenaliteJournaliere(montant, dateDebut, dateReference = new Date()) {
  if (!dateDebut) return { joursEnRetard: 0, moisEnRetard: 0, penalite: 0, finGrace: null };

  const finGrace = ajouterMois(enDate(dateDebut), MOIS_DE_GRACE);
  const aujourdhui = new Date(dateReference.getFullYear(), dateReference.getMonth(), dateReference.getDate());
  const joursEnRetard = Math.max(0, Math.round((aujourdhui - finGrace) / 86400000));
  const penalite = Math.round(Number(montant) * TAUX_PENALITE_MENSUEL * (joursEnRetard / JOURS_PAR_MOIS));

  return {
    joursEnRetard,
    moisEnRetard: Math.floor(joursEnRetard / JOURS_PAR_MOIS),
    penalite,
    // Date de fin du mois de grâce (rien à afficher quand il n'y a pas de grâce)
    finGrace: MOIS_DE_GRACE > 0 ? finGrace : null,
  };
}
