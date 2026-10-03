// =========================================================
// CEAI — Écran "Gestion de l'épargne" (admin + comptable)
// Le comptable (ou l'admin) valide les versements reçus et les
// demandes de retrait. Il ne peut modifier ni un montant ni un
// solde : tout passe par des fonctions SQL qui recalculent côté
// serveur (voir epargne.sql).
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import {
  PARTS_SEUIL,
  libelleType,
  calculerEpargne,
  totalValide,
  formaterFCFA,
  formaterDate,
  echapper,
  badgeStatut,
} from "./epargne-commun.js";

async function obtenirRole() {
  const moiId = await idProfilCourant();
  const { data } = await supabase.from("profils").select("role").eq("id", moiId).single();
  return data?.role || "membre";
}

export async function ecranAdminEpargne(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion de l'épargne</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;
  await rafraichir(conteneur);
}

function nomTitulaire(compte) {
  return compte ? `${echapper(compte.titulaire_prenom)} ${echapper(compte.titulaire_nom)}` : "—";
}

function descriptionCompte(compte) {
  return compte ? `Épargne ${libelleType(compte.type_epargne).toLowerCase()} · base ${formaterFCFA(compte.montant_base)}` : "";
}

async function rafraichir(conteneur) {
  const role = await obtenirRole();
  if (role !== "admin" && role !== "comptable") {
    conteneur.innerHTML = `
      <h2 class="titre-section">Gestion de l'épargne</h2>
      <hr class="trait-or" />
      <p style="color:var(--texte-secondaire)">Cet écran est réservé à l'administrateur et au comptable.</p>
    `;
    return;
  }

  const [{ data: comptes }, { data: versements }, { data: retraits }] = await Promise.all([
    supabase.from("epargne_comptes").select("*").order("cree_le", { ascending: false }),
    supabase.from("epargne_versements").select("*").order("cree_le", { ascending: true }),
    supabase.from("epargne_retraits").select("*").order("demande_le", { ascending: false }),
  ]);

  const listeComptes = comptes || [];
  const listeVersements = versements || [];
  const listeRetraits = retraits || [];
  const compteParId = Object.fromEntries(listeComptes.map((c) => [c.id, c]));

  const retraitsEnAttente = listeRetraits.filter((r) => r.statut === "en_attente");
  const retraitsFaits = listeRetraits.filter((r) => r.statut === "valide");
  const versementsEnAttente = listeVersements.filter((v) => v.statut === "en_attente");

  const totalDetenu = listeComptes
    .filter((c) => c.statut !== "retire")
    .reduce((somme, c) => somme + totalValide(listeVersements, c.id), 0);
  const beneficeEncaisse = retraitsFaits.reduce((somme, r) => somme + Number(r.part_benefice), 0);
  const fraisEncaisses = retraitsFaits.reduce((somme, r) => somme + Number(r.part_frais), 0);

  const blocRetraits = retraitsEnAttente.length
    ? retraitsEnAttente
        .map((r) => {
          const compte = compteParId[r.compte_id];
          return `
      <div class="carte">
        <p style="margin:0; font-weight:500">${nomTitulaire(compte)}</p>
        <p style="margin:2px 0 8px; font-size:12px; color:var(--texte-secondaire)">${descriptionCompte(compte)} · demandé le ${formaterDate(r.demande_le)}</p>
        <p style="margin:0; font-size:13px">Total épargné : ${formaterFCFA(r.total_epargne)}</p>
        <p style="margin:4px 0 0; font-size:13px">Part de l'association : ${formaterFCFA(Number(r.part_benefice) + Number(r.part_frais))}
          (bénéfice ${formaterFCFA(r.part_benefice)}, frais de réseau ${formaterFCFA(r.part_frais)})</p>
        <p style="margin:8px 0 12px; font-weight:500; color:var(--or-texte)">À remettre au membre : ${formaterFCFA(r.montant_membre)}</p>
        <div style="display:flex; gap:8px">
          <button data-retrait-valider="${r.id}" data-nom="${nomTitulaire(compte)}" data-montant="${r.montant_membre}" class="bouton" style="background:#4C9A6A; color:#fff; flex:1">Valider le retrait</button>
          <button data-retrait-rejeter="${r.id}" class="bouton" style="background:var(--danger); color:#fff; flex:1">Rejeter</button>
        </div>
      </div>`;
        })
        .join("")
    : `<p style="color:var(--texte-secondaire); font-size:13px">Aucune demande de retrait en attente.</p>`;

  const blocVersements = versementsEnAttente.length
    ? versementsEnAttente
        .map((v) => {
          const compte = compteParId[v.compte_id];
          return `
      <div class="carte" style="display:flex; justify-content:space-between; align-items:center; gap:10px">
        <div>
          <p style="margin:0; font-weight:500; font-size:14px">${nomTitulaire(compte)}</p>
          <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
            ${formaterFCFA(v.montant)} · ${formaterDate(v.date_versement)}${v.reference_paiement ? " · Réf. " + echapper(v.reference_paiement) : ""}
          </p>
          <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">${descriptionCompte(compte)}</p>
        </div>
        <div style="display:flex; gap:6px">
          <button data-versement-valider="${v.id}" class="bouton" style="background:#4C9A6A; color:#fff; padding:6px 10px; font-size:12px">Valider</button>
          <button data-versement-rejeter="${v.id}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 10px; font-size:12px">Rejeter</button>
        </div>
      </div>`;
        })
        .join("")
    : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun versement en attente.</p>`;

  const blocComptes = listeComptes.length
    ? listeComptes
        .map((c) => {
          const total = totalValide(listeVersements, c.id);
          const calc = calculerEpargne(total, Number(c.montant_base));
          return `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--bordure)">
        <div>
          <p style="margin:0; font-size:14px">${nomTitulaire(c)}</p>
          <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
            ${descriptionCompte(c)} · ${formaterFCFA(total)} sur ${formaterFCFA(calc.seuil)}
          </p>
        </div>
        ${badgeStatut(c.statut)}
      </div>`;
        })
        .join("")
    : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun compte d'épargne ouvert.</p>`;

  const blocRetraitsFaits = retraitsFaits.length
    ? retraitsFaits
        .map((r) => {
          const compte = compteParId[r.compte_id];
          return `
      <div style="padding:8px 0; border-top:1px solid var(--bordure)">
        <p style="margin:0; font-size:14px">${nomTitulaire(compte)} · ${formaterFCFA(r.montant_membre)} remis</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${formaterDate(r.traite_le)} · bénéfice ${formaterFCFA(r.part_benefice)} · frais de réseau ${formaterFCFA(r.part_frais)}
        </p>
      </div>`;
        })
        .join("")
    : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun retrait effectué pour le moment.</p>`;

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion de l'épargne</h2>
    <hr class="trait-or" />

    <div class="carte" style="text-align:center">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Versements validés (comptes non retirés)</p>
      <p style="font-family:var(--police-titre); font-size:26px; margin:0">${formaterFCFA(totalDetenu)}</p>
      <p style="color:var(--texte-secondaire); font-size:12px; margin:8px 0 0">
        Bénéfice encaissé : ${formaterFCFA(beneficeEncaisse)} · Frais de réseau : ${formaterFCFA(fraisEncaisses)}
      </p>
    </div>

    <p style="font-weight:500; margin:20px 0 8px">Demandes de retrait en attente (${retraitsEnAttente.length})</p>
    ${blocRetraits}

    <p style="font-weight:500; margin:20px 0 8px">Versements en attente (${versementsEnAttente.length})</p>
    ${blocVersements}

    <div style="display:flex; gap:8px; margin-top:20px; flex-wrap:wrap">
      <button id="bouton-basculer-comptes" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
        Comptes d'épargne (${listeComptes.length})
      </button>
      <button id="bouton-basculer-retraits" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
        Retraits effectués (${retraitsFaits.length})
      </button>
    </div>
    <div id="zone-comptes" class="carte" hidden style="margin-top:12px">${blocComptes}</div>
    <div id="zone-retraits" class="carte" hidden style="margin-top:12px">${blocRetraitsFaits}</div>
    <p style="font-size:12px; color:var(--texte-secondaire); margin-top:16px">
      Rappel : la part de l'association est de 1/${PARTS_SEUIL} du total épargné, répartie à 60 % en bénéfice et 40 % en frais de réseau.
      Vous ne pouvez modifier aucun montant : vous validez ou rejetez uniquement.
    </p>
  `;

  document.getElementById("bouton-basculer-comptes").addEventListener("click", () => {
    const zone = document.getElementById("zone-comptes");
    zone.hidden = !zone.hidden;
  });
  document.getElementById("bouton-basculer-retraits").addEventListener("click", () => {
    const zone = document.getElementById("zone-retraits");
    zone.hidden = !zone.hidden;
  });

  async function traiterVersement(id, valider) {
    const { error } = await supabase.rpc("epargne_traiter_versement", { p_versement: id, p_valider: valider });
    if (error) alert(error.message);
    rafraichir(conteneur);
  }

  async function traiterRetrait(id, accepter) {
    const { error } = await supabase.rpc("epargne_traiter_retrait", { p_retrait: id, p_accepter: accepter });
    if (error) alert(error.message);
    rafraichir(conteneur);
  }

  conteneur.querySelectorAll("[data-versement-valider]").forEach((bouton) => {
    bouton.addEventListener("click", () => traiterVersement(bouton.dataset.versementValider, true));
  });
  conteneur.querySelectorAll("[data-versement-rejeter]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      if (window.confirm("Rejeter ce versement ?")) traiterVersement(bouton.dataset.versementRejeter, false);
    });
  });

  conteneur.querySelectorAll("[data-retrait-valider]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const montant = Number(bouton.dataset.montant).toLocaleString("fr-FR");
      const message = `Confirmez-vous avoir remis ${montant} FCFA à ce membre ?\n\nLe compte sera définitivement retiré.`;
      if (window.confirm(message)) traiterRetrait(bouton.dataset.retraitValider, true);
    });
  });
  conteneur.querySelectorAll("[data-retrait-rejeter]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      if (window.confirm("Rejeter cette demande de retrait ? Le compte redeviendra actif.")) {
        traiterRetrait(bouton.dataset.retraitRejeter, false);
      }
    });
  });
                                                                          }
