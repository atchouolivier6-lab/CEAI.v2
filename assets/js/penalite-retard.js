// =========================================================
// CEAI — Pénalité de retard de versement (cotisation et tontine)
//
// Si un membre verse après la date limite de la session / du cycle,
// il ajoute une légère pénalité de 1 % du montant de la session
// (montant indicatif) ou du cycle (montant mensuel).
// =========================================================
import { formaterJour } from "./prets-penalite.js";

export { dateDuJour, formaterJour } from "./prets-penalite.js";

export const TAUX_RETARD_VERSEMENT = 0.01;

// Renvoie le montant de la pénalité (0 si pas de retard ou pas de date limite)
export function penaliteRetardVersement({ dateLimite, dateVersement, montantReference }) {
  if (!dateLimite || !dateVersement) return 0;
  if (String(dateVersement).slice(0, 10) <= String(dateLimite).slice(0, 10)) return 0;
  return Math.round(Number(montantReference || 0) * TAUX_RETARD_VERSEMENT);
}

// Texte affiché sur les cartes des sessions et des cycles
export function texteDateLimite(dateLimite) {
  return dateLimite ? `Clôture des versements prévue le ${formaterJour(dateLimite)}` : "";
}
