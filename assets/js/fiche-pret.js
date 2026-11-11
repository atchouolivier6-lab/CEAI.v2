// =========================================================
// CEAI — Fiches du service de prêt
//  - Fiche de prêt : disponible dès qu'un agent accepte la demande
//  - Fiche de remboursement : disponible une fois le prêt soldé
// Même moteur d'affichage et de PDF que les fiches de clôture.
// =========================================================
import { supabase } from "./supabase-client.js";
import { calculerPenaliteJournaliere, TAUX_PENALITE_MENSUEL } from "./prets-penalite.js";
import { fcfa, jour, anneeDe, dateJourComplete } from "./fiche-donnees.js";

const COULEUR = "#0f6b73";
const TAUX = `${Math.round(TAUX_PENALITE_MENSUEL * 100)} % par mois`;

const somme = (liste, cle) => liste.reduce((total, element) => total + Number(element[cle] || 0), 0);

function fonctionDuRole(role) {
  return role === "admin" ? "Administrateur" : role === "comptable" ? "Comptable" : "Agent";
}

function referenceDe(prefixe, annee, id) {
  return `CEAI-${prefixe}-${annee || "0000"}-${String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function signature(profil, libelle, date) {
  return profil ? { nom: profil.nom || "—", fonction: fonctionDuRole(profil.role), date, libelle } : null;
}

function nombreJours(debut, fin) {
  if (!debut || !fin) return null;
  const n = Math.round((new Date(String(fin).slice(0, 10)) - new Date(String(debut).slice(0, 10))) / 86400000);
  return Number.isNaN(n) || n < 0 ? null : n;
}

async function profilDe(id) {
  if (!id) return null;
  const { data } = await supabase.from("profils").select("nom, role").eq("id", id).maybeSingle();
  return data || null;
}

export async function chargerDonneesPret(demandeId) {
  const { data: demande, error } = await supabase.from("prets_demandes").select("*").eq("id", demandeId).single();
  if (error) throw error;

  const { data: bruts } = await supabase.from("prets_remboursements").select("*").eq("demande_id", demandeId).order("date_remboursement");
  const remboursements = (bruts || []).filter((r) => r.statut === "valide");
  const dernier = remboursements[remboursements.length - 1];

  const [membre, agent, confirmeur] = await Promise.all([
    profilDe(demande.membre_id),
    profilDe(demande.traite_par),
    profilDe(demande.solde_par || dernier?.valide_par),
  ]);
  return { demande, remboursements, membre, agent, confirmeur };
}

// ---------------------------------------------------------
// Fiche de prêt (à l'acceptation de la demande)
// ---------------------------------------------------------
export function construireFichePretOctroi(donnees, { lien = "", edite = dateJourComplete() } = {}) {
  const d = donnees.demande;
  const nom = donnees.membre?.nom || "—";
  const { finGrace } = calculerPenaliteJournaliere(d.montant, d.date_octroi);
  const finFranchise = finGrace ? jour(finGrace instanceof Date ? finGrace.toISOString() : finGrace) : "—";
  const annee = anneeDe(d.date_octroi) || anneeDe(d.traite_le) || anneeDe(d.cree_le);

  return {
    type: "pret-octroi",
    id: d.id,
    titreDocument: "FICHE DE PRÊT",
    etiquetteType: "PRÊT",
    nom,
    annee,
    pastilleBas: "ACCORDÉ",
    sousTitre: `Prêt accordé le ${jour(d.date_octroi)}`,
    couleur: COULEUR,
    identite: [
      [
        { label: "Emprunteur", valeur: nom, poids: 2 },
        { label: "Statut", valeur: "Accordé" },
        { label: "Montant du prêt", valeur: fcfa(d.montant) },
      ],
      [
        { label: "Demande déposée le", valeur: jour(d.cree_le) },
        { label: "Date du prêt", valeur: jour(d.date_octroi) },
        { label: "Validé le", valeur: jour(d.traite_le) },
      ],
      [
        { label: "Pénalité de retard", valeur: TAUX },
        { label: "Sans pénalité jusqu'au", valeur: finFranchise },
        { label: "Durée souhaitée", valeur: d.duree_souhaitee || "Non précisée" },
      ],
    ],
    tableau: null,
    synthese: [
      { label: "Montant accordé", valeur: fcfa(d.montant) },
      { label: "Date du prêt", valeur: jour(d.date_octroi) },
      { label: "Sans pénalité jusqu'au", valeur: finFranchise },
    ],
    bilan: {
      titre: "Conditions du prêt",
      lignes: [
        { rubrique: "Montant accordé", montant: fcfa(d.montant), detail: d.motif ? `Motif : ${d.motif}` : "Aucun motif renseigné." },
        { rubrique: "Date du prêt", montant: "", detail: `${jour(d.date_octroi)} — début du décompte des pénalités.` },
        {
          rubrique: "Pénalité de retard",
          montant: TAUX,
          detail: `Comptée jour par jour à partir de la date du prêt. Sans pénalité jusqu'au ${finFranchise}.`,
        },
        { rubrique: "Réponse de l'agent", montant: "", detail: d.reponse_admin || "Aucune remarque." },
      ],
    },
    etabliPar: signature(donnees.agent, "Prêt validé par", jour(d.traite_le)),
    edite,
    reference: referenceDe("PRE", annee, d.id),
    lien,
  };
}

// ---------------------------------------------------------
// Fiche de remboursement (prêt soldé)
// ---------------------------------------------------------
export function construireFichePretSolde(donnees, { lien = "", edite = dateJourComplete() } = {}) {
  const d = donnees.demande;
  const rem = donnees.remboursements;
  const nom = donnees.membre?.nom || "—";

  const totalRembourse = somme(rem, "montant");
  const penalite = d.penalite_finale != null ? Number(d.penalite_finale) : null;
  const totalDu = penalite == null ? null : Number(d.montant) + penalite;
  const reste = totalDu == null ? null : Math.max(0, totalDu - totalRembourse);

  const dernierRemb = rem.length ? rem[rem.length - 1].date_remboursement : null;
  const dateSolde = d.solde_le || dernierRemb;
  const nbJours = nombreJours(d.date_octroi, dateSolde);
  const annee = anneeDe(dateSolde) || anneeDe(d.date_octroi);

  let cumul = 0;
  const lignes = rem.map((r, i) => {
    cumul += Number(r.montant || 0);
    return [String(i + 1), jour(r.date_remboursement), fcfa(r.montant), fcfa(cumul), totalDu == null ? "—" : fcfa(Math.max(0, totalDu - cumul))];
  });

  const detailSolde =
    reste === 0
      ? "Prêt entièrement remboursé."
      : reste == null
        ? "Prêt marqué comme soldé par l'équipe."
        : `Prêt clôturé par l'équipe avec un reste de ${fcfa(reste)}.`;

  return {
    type: "pret-solde",
    id: d.id,
    titreDocument: "FICHE DE REMBOURSEMENT",
    etiquetteType: "PRÊT",
    nom,
    annee,
    pastilleBas: "SOLDÉ",
    sousTitre: `Prêt du ${jour(d.date_octroi)} · soldé le ${jour(dateSolde)}`,
    couleur: COULEUR,
    identite: [
      [
        { label: "Emprunteur", valeur: nom, poids: 2 },
        { label: "Statut", valeur: "Soldé" },
        { label: "Montant du prêt", valeur: fcfa(d.montant) },
      ],
      [
        { label: "Date du prêt", valeur: jour(d.date_octroi) },
        { label: "Dernier remboursement", valeur: jour(dernierRemb) },
        { label: "Soldé le", valeur: jour(dateSolde) },
      ],
      [
        { label: "Durée du prêt", valeur: nbJours == null ? "—" : `${nbJours} jour${nbJours > 1 ? "s" : ""}` },
        { label: "Remboursements validés", valeur: String(rem.length) },
        { label: "Pénalité appliquée", valeur: penalite == null ? "—" : fcfa(penalite) },
      ],
    ],
    tableau: {
      colonnes: [
        { titre: "N°", poids: 30, align: "center" },
        { titre: "DATE DU REMBOURSEMENT", poids: 150, align: "left" },
        { titre: "MONTANT REMBOURSÉ", poids: 120, align: "right" },
        { titre: "CUMUL REMBOURSÉ", poids: 120, align: "right" },
        { titre: "RESTE DÛ", poids: 95, align: "right" },
      ],
      lignes,
      total: ["", "Total remboursé :", fcfa(totalRembourse), "", ""],
    },
    synthese: [
      { label: "Montant du prêt", valeur: fcfa(d.montant) },
      { label: "Pénalité de retard", valeur: penalite == null ? "—" : fcfa(penalite) },
      { label: "Total à rembourser", valeur: totalDu == null ? "—" : fcfa(totalDu) },
      { label: "Total remboursé", valeur: fcfa(totalRembourse) },
      { label: "Solde restant", valeur: reste == null ? "—" : fcfa(reste) },
    ],
    bilan: {
      titre: "Bilan du prêt",
      lignes: [
        { rubrique: "Capital emprunté", montant: fcfa(d.montant), detail: `Prêt accordé le ${jour(d.date_octroi)}.` },
        {
          rubrique: "Pénalités de retard",
          montant: penalite == null ? "—" : fcfa(penalite),
          detail:
            penalite == null
              ? "Montant non enregistré pour ce prêt (soldé avant la mise en place de cette fiche)."
              : `Arrêtées au ${jour(dateSolde)} (${TAUX}, comptées jour par jour).`,
        },
        { rubrique: "Total remboursé", montant: fcfa(totalRembourse), detail: `${rem.length} remboursement${rem.length > 1 ? "s" : ""} validé${rem.length > 1 ? "s" : ""} par l'équipe.` },
      ],
      pied: { rubrique: "Solde restant", montant: reste == null ? "—" : fcfa(reste), detail: detailSolde },
    },
    mention: "Merci pour la confiance !",
    etabliPar: signature(donnees.confirmeur, "Remboursement confirmé par", jour(dateSolde)),
    edite,
    reference: referenceDe("REM", annee, d.id),
    lien,
  };
                        }
