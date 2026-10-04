// =========================================================
// CEAI — Écrans admin "Tableau de bord" et "Statistiques"
// =========================================================
import { supabase } from "../supabase-client.js";
import {
  carteStat as carteStatColoree,
  grilleStats,
  activerCartesCliquables,
  panneauActivites,
  panneauBeneficiaire,
  panneauATraiter,
  chargerProchainsBeneficiaires,
  formaterMontant,
} from "./composants-tableau.js";

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
  const enTete = `
    <h2 class="titre-section">Tableau de bord</h2>
    <hr class="trait-or" />
    <p class="accueil-sous-titre" style="margin-top:16px">Vue d'ensemble de l'activité de l'association.</p>
  `;
  conteneur.innerHTML = enTete + `<p class="chargement">Chargement…</p>`;

  const enAttente = (table) =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("statut", "en_attente");

  const [
    { data: capital },
    { data: sessionsOuvertes },
    { count: membresTotal },
    { count: membresActifs },
    { count: cotisationAttente },
    { count: tontineAttente },
    { count: epargneVersementsAttente },
    { count: epargneRetraitsAttente },
    { count: pretsAttente },
    { data: notifications },
    { data: comptesEpargne },
    { data: versementsEpargne },
    tontine,
  ] = await Promise.all([
    supabase.from("capital_cotisation").select("total").maybeSingle(),
    supabase.from("cotisation_sessions").select("nom").eq("statut", "ouverte"),
    supabase.from("profils").select("id", { count: "exact", head: true }),
    supabase.from("profils").select("id", { count: "exact", head: true }).eq("actif", true),
    enAttente("cotisation_versements"),
    enAttente("tontine_versements"),
    enAttente("epargne_versements"),
    enAttente("epargne_retraits"),
    enAttente("prets_demandes"),
    supabase.from("notifications").select("texte, cree_le").order("cree_le", { ascending: false }).limit(6),
    supabase.from("epargne_comptes").select("id").neq("statut", "retire"),
    supabase.from("epargne_versements").select("compte_id, montant").eq("statut", "valide"),
    chargerProchainsBeneficiaires(),
  ]);

  // Épargne détenue = versements validés des comptes non retirés
  const idsComptesEnCours = new Set((comptesEpargne || []).map((c) => c.id));
  const totalEpargne = (versementsEpargne || [])
    .filter((v) => idsComptesEnCours.has(v.compte_id))
    .reduce((somme, v) => somme + Number(v.montant), 0);

  const sessions = sessionsOuvertes || [];
  const noteCapital = !sessions.length
    ? "Aucune session ouverte"
    : sessions.length === 1
      ? sessions[0].nom
      : `${sessions.length} sessions ouvertes`;

  const lignesATraiter = [
    { libelle: "Versements de cotisation", nombre: cotisationAttente || 0, aller: "admin/cotisations" },
    { libelle: "Versements de tontine", nombre: tontineAttente || 0, aller: "admin/tontine" },
    { libelle: "Versements d'épargne", nombre: epargneVersementsAttente || 0, aller: "admin/epargne" },
    { libelle: "Demandes de retrait d'épargne", nombre: epargneRetraitsAttente || 0, aller: "admin/epargne" },
    { libelle: "Demandes de prêt", nombre: pretsAttente || 0, aller: "admin/prets" },
  ];
  const totalATraiter = lignesATraiter.reduce((somme, l) => somme + l.nombre, 0);

  const cartes = grilleStats([
    carteStatColoree({
      libelle: "Membres actifs",
      valeur: String(membresActifs || 0),
      note: `${membresTotal || 0} au total`,
      icone: "membres",
      couleur: "bleu",
      aller: "admin/membres",
    }),
    carteStatColoree({
      libelle: "Capital cotisation",
      valeur: formaterMontant(capital?.total),
      note: noteCapital,
      icone: "cotisation",
      couleur: "vert",
      aller: "admin/cotisations",
    }),
    carteStatColoree({
      libelle: "Épargne détenue",
      valeur: formaterMontant(totalEpargne),
      note: `${idsComptesEnCours.size} compte${idsComptesEnCours.size > 1 ? "s" : ""} en cours`,
      icone: "epargne",
      couleur: "or",
      aller: "admin/epargne",
    }),
    carteStatColoree({
      libelle: "À traiter",
      valeur: String(totalATraiter),
      note: totalATraiter > 0 ? "Voir le détail ci-dessous" : "Tout est à jour",
      icone: "alerte",
      couleur: totalATraiter > 0 ? "rouge" : "violet",
    }),
  ]);

  conteneur.innerHTML = `
    ${enTete}
    ${cartes}
    <div class="grille-panneaux">
      ${panneauATraiter(lignesATraiter)}
      ${panneauBeneficiaire(tontine)}
      ${panneauActivites("Activités récentes", notifications || [])}
    </div>
  `;

  activerCartesCliquables(conteneur);
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
