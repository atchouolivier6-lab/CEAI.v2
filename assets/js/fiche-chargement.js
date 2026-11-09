// =========================================================
// CEAI — Chargement des données d'une fiche de clôture
// Lit la base et renvoie exactement la forme attendue par
// fiche-donnees.js (construireFicheCotisation / construireFicheTontine).
// =========================================================
import { supabase } from "./supabase-client.js";

const somme = (liste, cle) => liste.reduce((total, element) => total + Number(element[cle] || 0), 0);
const jourSeul = (valeur) => (valeur ? String(valeur).slice(0, 10) : "");

async function lire(requete) {
  const { data, error } = await requete;
  return error ? [] : data || [];
}

async function nomsDesMembres(ids) {
  if (!ids.length) return {};
  const { data } = await supabase.from("profils").select("id, nom").in("id", ids);
  return Object.fromEntries((data || []).map((m) => [m.id, m.nom]));
}

// Date de remplissage du bilan : on prend la première colonne de date trouvée
function normaliserBilan(bilan) {
  if (!bilan) return null;
  return { ...bilan, rempli_le: bilan.rempli_le || bilan.modifie_le || bilan.updated_at || bilan.cree_le || bilan.created_at || null };
}

// Auteur du bilan (admin ou comptable) : première colonne d'auteur trouvée
async function etabliPar(bilan) {
  if (!bilan) return null;
  const id = bilan.rempli_par || bilan.etabli_par || bilan.auteur_id || bilan.cree_par || bilan.modifie_par;
  if (!id) return null;
  const { data } = await supabase.from("profils").select("nom, role").eq("id", id).maybeSingle();
  return data ? { nom: data.nom, role: data.role } : null;
}

// ---------------------------------------------------------
// Session de cotisation
// ---------------------------------------------------------
export async function chargerDonneesCotisation(sessionId) {
  const { data: session, error } = await supabase.from("cotisation_sessions").select("*").eq("id", sessionId).single();
  if (error) throw error;

  const versements = (await lire(supabase.from("cotisation_versements").select("*").eq("session_id", sessionId))).filter(
    (v) => v.statut === "valide"
  );
  const adhesions = await lire(supabase.from("cotisation_adhesions").select("membre_id").eq("session_id", sessionId));

  const ids = [...new Set([...adhesions.map((a) => a.membre_id), ...versements.map((v) => v.membre_id)])];
  const noms = await nomsDesMembres(ids);
  const limite = jourSeul(session.date_limite_versement);

  const lignes = ids
    .map((id) => {
      const siens = versements.filter((v) => v.membre_id === id);
      return {
        nom: noms[id] || "—",
        nb: siens.length,
        total: somme(siens, "montant"),
        penalites: somme(siens, "penalite_retard"),
        en_retard: limite ? siens.some((v) => jourSeul(v.date_versement) > limite) : false,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const { data: bilanBrut } = await supabase.from("cotisation_bilans").select("*").eq("session_id", sessionId).maybeSingle();
  const bilan = normaliserBilan(bilanBrut);
  return { session, lignes, bilan, etabli_par: await etabliPar(bilan) };
}

// ---------------------------------------------------------
// Cycle de tontine
// ---------------------------------------------------------
export async function chargerDonneesTontine(cycleId) {
  const { data: cycle, error } = await supabase.from("tontine_cycles").select("*").eq("id", cycleId).single();
  if (error) throw error;

  const participants = await lire(
    supabase.from("tontine_participants").select("id, membre_id, ordre_tour, a_recu, recu_le").eq("cycle_id", cycleId)
  );
  const versements = (await lire(supabase.from("tontine_versements").select("*").eq("cycle_id", cycleId))).filter(
    (v) => v.statut === "valide"
  );
  const noms = await nomsDesMembres([...new Set(participants.map((p) => p.membre_id))]);

  const lignes = [...participants]
    .sort((a, b) => (a.ordre_tour || 0) - (b.ordre_tour || 0))
    .map((p) => {
      const siens = versements.filter((v) => v.participant_id === p.id);
      return {
        nom: noms[p.membre_id] || "—",
        ordre: p.ordre_tour,
        nb: siens.length,
        total: somme(siens, "montant"),
        penalites: somme(siens, "penalite_retard"),
        a_recu: p.a_recu,
        recu_le: p.recu_le,
        en_retard: false,
      };
    });

  const { data: bilanBrut } = await supabase.from("tontine_bilans").select("*").eq("cycle_id", cycleId).maybeSingle();
  const bilan = normaliserBilan(bilanBrut);
  const beneficiaire = bilan ? participants.find((p) => p.id === bilan.beneficiaire_participant_id) : null;

  return {
    cycle,
    lignes,
    bilan,
    beneficiaire: beneficiaire ? { nom: noms[beneficiaire.membre_id] || "—" } : null,
    etabli_par: await etabliPar(bilan),
  };
}
