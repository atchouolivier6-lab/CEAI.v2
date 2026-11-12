// =========================================================
// CEAI — Fiche de retrait d'épargne
// Disponible dès qu'un agent (comptable ou admin) a validé le retrait.
// Même moteur d'affichage et de PDF que les autres fiches.
// =========================================================
import { supabase } from "./supabase-client.js";
import { fcfa, jour, anneeDe, dateJourComplete } from "./fiche-donnees.js";
import { libelleType, PARTS_SEUIL } from "./ecrans/epargne-commun.js";

const COULEUR = "#7d3a21";

function fonctionDuRole(role) {
  return role === "admin" ? "Administrateur" : role === "comptable" ? "Comptable" : "Agent";
}

function referenceDe(prefixe, annee, id) {
  return `CEAI-${prefixe}-${annee || "0000"}-${String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

async function profilDe(id) {
  if (!id) return null;
  const { data } = await supabase.from("profils").select("nom, role").eq("id", id).maybeSingle();
  return data || null;
}

export async function chargerDonneesRetrait(retraitId) {
  const { data: retrait, error } = await supabase.from("epargne_retraits").select("*").eq("id", retraitId).single();
  if (error) throw error;

  const { data: compte } = await supabase.from("epargne_comptes").select("*").eq("id", retrait.compte_id).maybeSingle();
  const { data: bruts } = await supabase.from("epargne_versements").select("*").eq("compte_id", retrait.compte_id).order("date_versement");
  const versements = (bruts || []).filter((v) => v.statut === "valide");

  // Agent qui a validé le retrait : première colonne d'auteur trouvée
  const agent = await profilDe(retrait.traite_par || retrait.valide_par || retrait.etabli_par || retrait.agent_id);
  return { retrait, compte: compte || {}, versements, agent };
}

export function construireFicheRetrait(donnees, { lien = "", edite = dateJourComplete() } = {}) {
  const r = donnees.retrait;
  const c = donnees.compte;
  const versements = donnees.versements;

  const titulaire = [c.titulaire_prenom, c.titulaire_nom].filter(Boolean).join(" ") || "—";
  const societe = Number(r.part_benefice || 0) + Number(r.part_frais || 0);
  const annee = anneeDe(r.traite_le) || anneeDe(r.demande_le);
  const base = Number(c.montant_base || 0);
  const nb = versements.length;

  let cumul = 0;
  const lignes = versements.map((v, i) => {
    cumul += Number(v.montant || 0);
    return [String(i + 1), jour(v.date_versement), fcfa(v.montant), fcfa(cumul)];
  });
  const totalVerse = versements.reduce((somme, v) => somme + Number(v.montant || 0), 0);

  return {
    type: "epargne-retrait",
    id: r.id,
    titreDocument: "FICHE DE RETRAIT",
    etiquetteType: "ÉPARGNE",
    nom: titulaire,
    annee,
    pastilleBas: "RETIRÉ",
    sousTitre: `Épargne ${libelleType(c.type_epargne).toLowerCase()} · retrait validé le ${jour(r.traite_le)}`,
    couleur: COULEUR,
    identite: [
      [
        { label: "Titulaire", valeur: titulaire, poids: 2 },
        { label: "Statut", valeur: "Retrait effectué" },
        { label: "Montant remis", valeur: fcfa(r.montant_membre) },
      ],
      [
        { label: "Type d'épargne", valeur: libelleType(c.type_epargne) },
        { label: "Montant de base", valeur: fcfa(base) },
        { label: "Seuil de retrait", valeur: fcfa(base * PARTS_SEUIL) },
      ],
      [
        { label: "Compte ouvert le", valeur: jour(c.cree_le) },
        { label: "Retrait demandé le", valeur: jour(r.demande_le) },
        { label: "Retrait validé le", valeur: jour(r.traite_le) },
      ],
    ],
    tableau: {
      colonnes: [
        { titre: "N°", poids: 30, align: "center" },
        { titre: "DATE DU VERSEMENT", poids: 200, align: "left" },
        { titre: "MONTANT VERSÉ", poids: 140, align: "right" },
        { titre: "CUMUL ÉPARGNÉ", poids: 145, align: "right" },
      ],
      lignes,
      total: ["", "Total des versements validés :", fcfa(totalVerse), ""],
    },
    synthese: [
      { label: "Total épargné", valeur: fcfa(r.total_epargne) },
      { label: "Part de l'association", valeur: fcfa(societe) },
      { label: "Dont bénéfice", valeur: fcfa(r.part_benefice) },
      { label: "Dont frais de réseau", valeur: fcfa(r.part_frais) },
      { label: "Montant remis", valeur: fcfa(r.montant_membre) },
    ],
    bilan: {
      titre: "Détail du retrait",
      lignes: [
        {
          rubrique: "Total épargné",
          montant: fcfa(r.total_epargne),
          detail: `${nb} versement${nb > 1 ? "s" : ""} validé${nb > 1 ? "s" : ""} sur le compte.`,
        },
        {
          rubrique: "Part de l'association",
          montant: fcfa(societe),
          detail: `1/${PARTS_SEUIL} du total épargné : bénéfice ${fcfa(r.part_benefice)}, frais de réseau ${fcfa(r.part_frais)}.`,
        },
      ],
      pied: {
        rubrique: "Montant remis au membre",
        montant: fcfa(r.montant_membre),
        detail: "Le compte est désormais retiré : le retrait est total.",
      },
    },
    etabliPar: donnees.agent
      ? { nom: donnees.agent.nom || "—", fonction: fonctionDuRole(donnees.agent.role), date: jour(r.traite_le), libelle: "Retrait validé par" }
      : null,
    edite,
    reference: referenceDe("RET", annee, r.id),
    lien,
  };
                                       }
