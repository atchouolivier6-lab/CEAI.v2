// =========================================================
// CEAI — Épargne : outils partagés (écrans membre et comptable)
// Les règles de calcul ci-dessous sont identiques à celles des
// fonctions SQL (epargne.sql). Le serveur recalcule toujours
// lui-même au moment du retrait : l'affichage ici est informatif.
// =========================================================

export const MONTANT_MINIMUM = 100;
export const PARTS_SEUIL = 11; // seuil de retrait = 11 x montant de base

export const TYPES_EPARGNE = {
  journaliere: { libelle: "Journalière", jours: 1 },
  hebdomadaire: { libelle: "Hebdomadaire", jours: 7 },
  mensuelle: { libelle: "Mensuelle", mois: 1 },
};

export function libelleType(cle) {
  return TYPES_EPARGNE[cle]?.libelle || cle;
}

// total = somme des versements validés ; montantBase = montant choisi à l'ouverture
export function calculerEpargne(total, montantBase) {
  const seuil = montantBase * PARTS_SEUIL;
  const retirable = Math.floor((total * 10) / 11);
  const societe = total - retirable;
  const benefice = Math.floor((societe * 60) / 100);
  const frais = societe - benefice;
  return {
    seuil,
    seuilAtteint: total >= seuil,
    progression: seuil > 0 ? Math.min(100, Math.round((total / seuil) * 100)) : 0,
    retirable,
    societe,
    benefice,
    frais,
  };
}

export function totalValide(versements, compteId) {
  return (versements || [])
    .filter((v) => v.compte_id === compteId && v.statut === "valide")
    .reduce((somme, v) => somme + Number(v.montant), 0);
}

export function formaterFCFA(montant) {
  return `${Number(montant || 0).toLocaleString("fr-FR")} FCFA`;
}

export function formaterDate(dateIso) {
  return dateIso
    ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

// Protège l'affichage des textes saisis par les membres (noms, références)
export function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function badgeStatut(statut) {
  const libelles = {
    en_attente: "En attente",
    valide: "Validé",
    rejete: "Rejeté",
    actif: "Actif",
    retrait_demande: "Retrait demandé",
    retire: "Retiré",
  };
  const couleurs = {
    en_attente: "var(--or-texte)",
    retrait_demande: "var(--or-texte)",
    valide: "#4C9A6A",
    actif: "#4C9A6A",
    rejete: "var(--danger)",
    retire: "var(--texte-secondaire)",
  };
  return `<span style="font-size:11px; color:${couleurs[statut] || "var(--texte-secondaire)"};
          border:1px solid currentColor; padding:2px 8px; border-radius:999px; white-space:nowrap">${libelles[statut] || statut}</span>`;
}

export function barreProgression(pourcentage) {
  return `
    <div style="background:var(--fond); border:1px solid var(--bordure); border-radius:999px; height:8px; overflow:hidden">
      <div style="width:${pourcentage}%; height:100%; background:var(--or-texte)"></div>
    </div>`;
}

// Prochaines dates de versement attendues, selon le rythme choisi
export function prochainsVersements(typeCle, creeLe, nombre = 3) {
  const type = TYPES_EPARGNE[typeCle];
  if (!type) return [];

  const debut = new Date(creeLe);
  debut.setHours(0, 0, 0, 0);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);

  const echeance = (i) =>
    type.mois
      ? new Date(debut.getFullYear(), debut.getMonth() + i * type.mois, Math.min(debut.getDate(), 28))
      : new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i * type.jours);

  const dates = [];
  for (let i = 0; i < 5000 && dates.length < nombre; i++) {
    const date = echeance(i);
    if (date >= aujourdhui) dates.push(date);
  }
  return dates;
}

export function naviguer(route) {
  window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: route }));
    }
