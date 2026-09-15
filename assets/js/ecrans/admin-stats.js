// =========================================================
// CEAI — Écrans admin "Tableau de bord" et "Statistiques"
// =========================================================
import { supabase } from "../supabase-client.js";

function carteStat(titre, valeur, sousTexte) {
  return `
    <div class="carte">
      <p style="margin:0; font-size:13px; color:var(--texte-secondaire)">${titre}</p>
      <p style="margin:4px 0 0; font-family:var(--police-titre); font-size:26px">${valeur}</p>
      ${sousTexte ? `<p style="margin:4px 0 0; font-size:12px; color:var(--texte-secondaire)">${sousTexte}</p>` : ""}
    </div>
  `;
}

// =========================================================
// Tableau de bord — vue rapide de l'activité en cours
// =========================================================
export async function ecranAdminTableauBord(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Tableau de bord</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const [
    { data: capital },
    { data: sessionOuverte },
    { data: cycleOuvert },
    { count: nombreMembres },
    { count: versementsCotisationEnAttente },
    { count: versementsTontineEnAttente },
    { count: pretsEnAttente },
    { data: dernieresPublications },
  ] = await Promise.all([
    supabase.from("capital_cotisation").select("total").maybeSingle(),
    supabase.from("cotisation_sessions").select("nom").eq("statut", "ouverte").maybeSingle(),
    supabase.from("tontine_cycles").select("nom, montant_mensuel").eq("statut", "ouvert").maybeSingle(),
    supabase.from("profils").select("id", { count: "exact", head: true }),
    supabase.from("cotisation_versements").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
    supabase.from("tontine_versements").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
    supabase.from("prets_demandes").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
    supabase.from("publications").select("id, cree_le").order("cree_le", { ascending: false }).limit(3),
  ]);

  const actionsEnAttente = (versementsCotisationEnAttente || 0) + (versementsTontineEnAttente || 0) + (pretsEnAttente || 0);

  conteneur.innerHTML = `
    <h2 class="titre-section">Tableau de bord</h2>
    <hr class="trait-or" />

    ${
      actionsEnAttente > 0
        ? `<div class="carte" style="border-color:var(--or); background:var(--fond-carte-claire)">
            <p style="margin:0; font-weight:500">⚠️ ${actionsEnAttente} action${actionsEnAttente > 1 ? "s" : ""} en attente</p>
            <p style="margin:4px 0 0; font-size:13px; color:var(--texte-secondaire)">
              ${versementsCotisationEnAttente || 0} versement(s) cotisation · ${versementsTontineEnAttente || 0} versement(s) tontine · ${pretsEnAttente || 0} demande(s) de prêt
            </p>
          </div>`
        : ""
    }

    ${carteStat("Capital cotisation (session en cours)", `${Number(capital?.total || 0).toLocaleString("fr-FR")} FCFA`, sessionOuverte ? sessionOuverte.nom : "Aucune session ouverte")}
    ${carteStat("Cycle de tontine en cours", cycleOuvert ? cycleOuvert.nom : "—", cycleOuvert ? `${Number(cycleOuvert.montant_mensuel).toLocaleString("fr-FR")} FCFA / mois` : "Aucun cycle ouvert")}
    ${carteStat("Membres", nombreMembres || 0, "au total, tous rôles confondus")}

    <p style="font-weight:500; margin:20px 0 8px">Dernières publications</p>
    ${
      dernieresPublications && dernieresPublications.length
        ? `<p style="color:var(--texte-secondaire); font-size:13px">${dernieresPublications.length} publication(s) récente(s) — voir le fil dans Publications.</p>`
        : `<p style="color:var(--texte-secondaire); font-size:13px">Aucune publication pour le moment.</p>`
    }
  `;
}

// =========================================================
// Statistiques et rapports — vue d'ensemble historique
// =========================================================
export async function ecranAdminStatistiques(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Statistiques et rapports</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const [
    { data: tousLesVersementsCotisation },
    { data: tousLesVersementsTontine },
    { count: sessionsCloturees },
    { count: cyclesClotures },
    { count: publicationsCount },
    { count: nombreAdmins },
    { count: nombreMembresSansCompte },
    { data: pretsParStatut },
  ] = await Promise.all([
    supabase.from("cotisation_versements").select("montant").eq("statut", "valide"),
    supabase.from("tontine_versements").select("montant").eq("statut", "valide"),
    supabase.from("cotisation_sessions").select("id", { count: "exact", head: true }).eq("statut", "cloturee"),
    supabase.from("tontine_cycles").select("id", { count: "exact", head: true }).eq("statut", "cloture"),
    supabase.from("publications").select("id", { count: "exact", head: true }),
    supabase.from("profils").select("id", { count: "exact", head: true }).eq("role", "admin"),
    supabase.from("profils").select("id", { count: "exact", head: true }).eq("a_un_compte", false),
    supabase.from("prets_demandes").select("statut"),
  ]);

  const totalCotisationHistorique = (tousLesVersementsCotisation || []).reduce((s, v) => s + Number(v.montant), 0);
  const totalTontineHistorique = (tousLesVersementsTontine || []).reduce((s, v) => s + Number(v.montant), 0);

  const comptePrets = { en_attente: 0, acceptee: 0, refusee: 0 };
  (pretsParStatut || []).forEach((p) => comptePrets[p.statut]++);

  conteneur.innerHTML = `
    <h2 class="titre-section">Statistiques et rapports</h2>
    <hr class="trait-or" />

    <p style="font-weight:500; margin:0 0 8px">Cotisation</p>
    ${carteStat("Total validé (historique complet)", `${totalCotisationHistorique.toLocaleString("fr-FR")} FCFA`, `${sessionsCloturees || 0} session(s) clôturée(s)`)}

    <p style="font-weight:500; margin:20px 0 8px">Tontine</p>
    ${carteStat("Total versé (historique complet)", `${totalTontineHistorique.toLocaleString("fr-FR")} FCFA`, `${cyclesClotures || 0} cycle(s) clôturé(s)`)}

    <p style="font-weight:500; margin:20px 0 8px">Membres</p>
    ${carteStat("Répartition", `${nombreAdmins || 0} admin(s)`, `${nombreMembresSansCompte || 0} fiche(s) sans compte de connexion`)}

    <p style="font-weight:500; margin:20px 0 8px">Prêts</p>
    ${carteStat("Demandes", `${comptePrets.en_attente} en attente`, `${comptePrets.acceptee} acceptée(s) · ${comptePrets.refusee} refusée(s)`)}

    <p style="font-weight:500; margin:20px 0 8px">Publications</p>
    ${carteStat("Total publié", publicationsCount || 0, "depuis le lancement")}
  `;
    }
