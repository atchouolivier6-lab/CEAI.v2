// =========================================================
// CEAI — Écrans "Épargne" (côté membre)
// Chaque membre ouvre un ou plusieurs comptes d'épargne
// personnels. Les versements sont déclarés puis validés par le
// comptable ; le retrait n'est possible qu'à partir du seuil
// (11 x montant de base) et vide tout le compte.
// Le paiement en ligne n'est pas encore branché : le membre
// déclare son versement avec la référence de son paiement.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import {
  MONTANT_MINIMUM,
  PARTS_SEUIL,
  TYPES_EPARGNE,
  libelleType,
  calculerEpargne,
  totalValide,
  formaterFCFA,
  formaterDate,
  echapper,
  badgeStatut,
  barreProgression,
  prochainsVersements,
  naviguer,
} from "./epargne-commun.js";

const STYLE_SELECT = `background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit);
  padding:11px 12px; color:var(--texte); font-family:inherit; font-size:15px`;

// Compte à présélectionner quand on clique "Faire un versement" depuis ses détails
let comptePreselectionne = null;

async function chargerMesDonnees() {
  const moiId = await idProfilCourant();

  const { data: comptes } = await supabase
    .from("epargne_comptes")
    .select("*")
    .eq("membre_id", moiId)
    .order("cree_le", { ascending: false });

  const liste = comptes || [];
  if (!liste.length) return { moiId, comptes: [], versements: [], retraits: [] };

  const ids = liste.map((c) => c.id);
  const [{ data: versements }, { data: retraits }] = await Promise.all([
    supabase.from("epargne_versements").select("*").in("compte_id", ids).order("cree_le", { ascending: false }),
    supabase.from("epargne_retraits").select("*").in("compte_id", ids).order("demande_le", { ascending: false }),
  ]);

  return { moiId, comptes: liste, versements: versements || [], retraits: retraits || [] };
}

// =========================================================
// Mon épargne : liste de mes comptes, ou détails d'un compte
// =========================================================
export async function ecranEpargneComptes(conteneur, compteIdOuvert = null) {
  conteneur.innerHTML = `<h2 class="titre-section">Mon épargne</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const donnees = await chargerMesDonnees();
  const compteOuvert = compteIdOuvert ? donnees.comptes.find((c) => c.id === compteIdOuvert) : null;

  if (compteOuvert) {
    rendreDetailCompte(conteneur, donnees, compteOuvert);
  } else {
    rendreListeComptes(conteneur, donnees);
  }
}

function rendreListeComptes(conteneur, donnees) {
  const { comptes, versements } = donnees;

  if (!comptes.length) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Mon épargne</h2>
      <hr class="trait-or" />
      <div class="carte">
        <p style="margin:0">Vous n'avez pas encore de compte d'épargne.</p>
        <p style="margin:6px 0 12px; font-size:13px; color:var(--texte-secondaire)">
          Ouvrez un compte, choisissez votre rythme et votre montant de base, puis versez à votre rythme à partir de ${formaterFCFA(MONTANT_MINIMUM)}.
        </p>
        <button id="bouton-ouvrir-compte" class="bouton bouton-or">Ouvrir un compte d'épargne</button>
      </div>
    `;
    document.getElementById("bouton-ouvrir-compte").addEventListener("click", () => naviguer("epargne/ouvrir"));
    return;
  }

  const totalGeneral = comptes
    .filter((c) => c.statut !== "retire")
    .reduce((somme, c) => somme + totalValide(versements, c.id), 0);

  const cartes = comptes
    .map((c) => {
      const total = totalValide(versements, c.id);
      const calc = calculerEpargne(total, Number(c.montant_base));
      return `
      <div class="carte" data-ouvrir-compte="${c.id}" style="cursor:pointer">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
          <div>
            <p style="margin:0; font-weight:500">Épargne ${libelleType(c.type_epargne).toLowerCase()}</p>
            <p style="margin:4px 0 0; font-size:12px; color:var(--texte-secondaire)">
              ${echapper(c.titulaire_prenom)} ${echapper(c.titulaire_nom)} · base ${formaterFCFA(c.montant_base)}
            </p>
          </div>
          ${badgeStatut(c.statut)}
        </div>
        ${
          c.statut === "retire"
            ? `<p style="margin:12px 0 0; font-size:13px; color:var(--texte-secondaire)">Compte retiré le ${formaterDate(c.retire_le)}</p>`
            : `<div style="margin-top:12px">
                 <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--texte-secondaire); margin-bottom:6px">
                   <span>${formaterFCFA(total)}</span>
                   <span>Seuil : ${formaterFCFA(calc.seuil)}</span>
                 </div>
                 ${barreProgression(calc.progression)}
               </div>`
        }
      </div>`;
    })
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Mon épargne</h2>
    <hr class="trait-or" />
    <div class="carte" style="text-align:center">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Total épargné (versements validés)</p>
      <p style="font-family:var(--police-titre); font-size:26px; margin:0">${formaterFCFA(totalGeneral)}</p>
      <div style="display:flex; gap:8px; margin-top:14px">
        <button id="bouton-verser" class="bouton bouton-or" style="flex:1">Faire un versement</button>
        <button id="bouton-ouvrir-compte" class="bouton" style="flex:1; background:var(--fond-carte-claire); color:var(--texte)">Ouvrir un compte</button>
      </div>
    </div>
    <p style="font-weight:500; margin:20px 0 8px">Mes comptes d'épargne</p>
    ${cartes}
  `;

  document.getElementById("bouton-verser").addEventListener("click", () => naviguer("epargne/verser"));
  document.getElementById("bouton-ouvrir-compte").addEventListener("click", () => naviguer("epargne/ouvrir"));
  conteneur.querySelectorAll("[data-ouvrir-compte]").forEach((carte) => {
    carte.addEventListener("click", () => ecranEpargneComptes(conteneur, carte.dataset.ouvrirCompte));
  });
}

function rendreDetailCompte(conteneur, donnees, compte) {
  const versementsCompte = donnees.versements.filter((v) => v.compte_id === compte.id);
  const total = totalValide(donnees.versements, compte.id);
  const calc = calculerEpargne(total, Number(compte.montant_base));
  const versementsEnAttente = versementsCompte.filter((v) => v.statut === "en_attente").length;
  const retrait = donnees.retraits.find((r) => r.compte_id === compte.id && r.statut !== "rejete");
  const estActif = compte.statut === "actif";

  let blocRetrait = "";
  if (compte.statut === "retire") {
    blocRetrait = `
      <div class="carte">
        <p style="margin:0">Compte retiré le ${formaterDate(compte.retire_le)}.</p>
        ${retrait ? `<p style="margin:6px 0 0; font-size:13px; color:var(--texte-secondaire)">Montant remis : ${formaterFCFA(retrait.montant_membre)}</p>` : ""}
        <button id="bouton-nouveau-compte" class="bouton bouton-or" style="margin-top:12px">Ouvrir un nouveau compte</button>
      </div>`;
  } else if (compte.statut === "retrait_demande") {
    blocRetrait = `
      <div class="carte">
        <p style="margin:0">Votre demande de retrait de ${formaterFCFA(retrait?.montant_membre ?? calc.retirable)} est en attente de validation par le comptable.</p>
        <p style="margin:6px 0 0; font-size:13px; color:var(--texte-secondaire)">Contactez le comptable pour convenir de la remise de votre argent.</p>
      </div>`;
  } else if (calc.seuilAtteint) {
    blocRetrait = `
      <div class="carte">
        <p style="margin:0">Le seuil est atteint : vous pouvez demander le retrait.</p>
        <p style="margin:6px 0 12px; font-size:13px; color:var(--texte-secondaire)">
          Le retrait vide tout le compte (${formaterFCFA(calc.retirable)} pour vous). Vous pouvez aussi continuer à épargner : votre montant retirable augmente à chaque versement validé.
          ${versementsEnAttente ? `<br />Des versements sont en attente de validation : attendez leur traitement avant de demander le retrait.` : ""}
        </p>
        <button id="bouton-demander-retrait" class="bouton bouton-or" ${versementsEnAttente ? "disabled" : ""}>Demander le retrait</button>
      </div>`;
  } else {
    blocRetrait = `
      <div class="carte">
        <p style="margin:0; font-size:14px">
          Le retrait sera possible quand votre épargne atteindra ${formaterFCFA(calc.seuil)}.
          Il vous reste ${formaterFCFA(calc.seuil - total)} à épargner.
        </p>
      </div>`;
  }

  const echeances = estActif
    ? prochainsVersements(compte.type_epargne, compte.cree_le, 3)
        .map(
          (date) => `
      <div class="carte" style="display:flex; justify-content:space-between; align-items:center">
        <span style="font-size:14px">${formaterDate(date)}</span>
        <span style="font-weight:500">${formaterFCFA(compte.montant_base)}</span>
      </div>`
        )
        .join("")
    : "";

  const historique = versementsCompte.length
    ? versementsCompte
        .map(
          (v) => `
      <div class="carte" style="display:flex; justify-content:space-between; align-items:center">
        <div>
          <p style="margin:0; font-weight:500">${formaterFCFA(v.montant)}</p>
          <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
            ${formaterDate(v.date_versement)}${v.reference_paiement ? " · Réf. " + echapper(v.reference_paiement) : ""}
          </p>
        </div>
        <div style="display:flex; align-items:center; gap:8px">
          ${badgeStatut(v.statut)}
          ${v.statut === "en_attente" ? `<button data-supprimer-versement="${v.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>` : ""}
        </div>
      </div>`
        )
        .join("")
    : `<p style="color:var(--texte-secondaire)">Aucun versement déclaré pour le moment.</p>`;

  conteneur.innerHTML = `
    <button id="bouton-retour" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); margin-bottom:12px">Retour</button>
    <h2 class="titre-section">Épargne ${libelleType(compte.type_epargne).toLowerCase()}</h2>
    <hr class="trait-or" />
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
      <span style="font-size:13px; color:var(--texte-secondaire)">${echapper(compte.titulaire_prenom)} ${echapper(compte.titulaire_nom)} · base ${formaterFCFA(compte.montant_base)}</span>
      ${badgeStatut(compte.statut)}
    </div>

    <div class="carte" style="text-align:center">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Total épargné</p>
      <p style="font-family:var(--police-titre); font-size:26px; margin:0">${formaterFCFA(total)}</p>
      <p style="color:var(--texte-secondaire); font-size:13px; margin:14px 0 4px">Montant retirable</p>
      <p style="font-family:var(--police-titre); font-size:26px; margin:0">${formaterFCFA(calc.retirable)}</p>
      <p style="color:var(--texte-secondaire); font-size:12px; margin:8px 0 0">
        Part de l'association (1/${PARTS_SEUIL}) : ${formaterFCFA(calc.societe)}. Elle évolue avec chaque versement validé.
      </p>
      ${
        compte.statut === "retire"
          ? ""
          : `<div style="margin-top:14px; text-align:left">
               <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--texte-secondaire); margin-bottom:6px">
                 <span>Progression vers le seuil</span><span>${formaterFCFA(calc.seuil)}</span>
               </div>
               ${barreProgression(calc.progression)}
             </div>`
      }
    </div>

    ${blocRetrait}

    ${estActif ? `<button id="bouton-verser-compte" class="bouton bouton-or" style="width:100%; margin-bottom:8px">Faire un versement</button>` : ""}

    ${estActif ? `<p style="font-weight:500; margin:20px 0 8px">Prochains versements</p>${echeances}` : ""}

    <p style="font-weight:500; margin:20px 0 8px">Historique des versements</p>
    ${historique}
  `;

  document.getElementById("bouton-retour").addEventListener("click", () => ecranEpargneComptes(conteneur));

  document.getElementById("bouton-nouveau-compte")?.addEventListener("click", () => naviguer("epargne/ouvrir"));

  document.getElementById("bouton-verser-compte")?.addEventListener("click", () => {
    comptePreselectionne = compte.id;
    naviguer("epargne/verser");
  });

  document.getElementById("bouton-demander-retrait")?.addEventListener("click", async () => {
    const message =
      `Demander le retrait de ${formaterFCFA(calc.retirable)} ?\n\n` +
      `Le retrait vide tout le compte : ${formaterFCFA(calc.societe)} reviennent à l'association (part de 1/${PARTS_SEUIL}). ` +
      `Vous ne pourrez plus verser sur ce compte, mais vous pourrez en ouvrir un nouveau.`;
    if (!window.confirm(message)) return;

    const { error } = await supabase.rpc("epargne_demander_retrait", { p_compte: compte.id });
    if (error) {
      alert(error.message);
      return;
    }
    ecranEpargneComptes(conteneur, compte.id);
  });

  conteneur.querySelectorAll("[data-supprimer-versement]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm("Supprimer ce versement ?")) return;
      await supabase.from("epargne_versements").delete().eq("id", bouton.dataset.supprimerVersement);
      ecranEpargneComptes(conteneur, compte.id);
    });
  });
}

// =========================================================
// Ouvrir un compte d'épargne
// =========================================================
export async function ecranEpargneOuvrir(conteneur) {
  const moiId = await idProfilCourant();

  conteneur.innerHTML = `
    <h2 class="titre-section">Ouvrir un compte d'épargne</h2>
    <hr class="trait-or" />
    <form id="formulaire-ouverture-epargne" class="carte" style="display:flex; flex-direction:column; gap:16px">
      <label class="champ">
        <span>Prénom</span>
        <input type="text" name="prenom" required />
      </label>
      <label class="champ">
        <span>Nom</span>
        <input type="text" name="nom" required />
      </label>
      <label class="champ">
        <span>Type d'épargne</span>
        <select name="type_epargne" required style="${STYLE_SELECT}">
          ${Object.entries(TYPES_EPARGNE).map(([cle, t]) => `<option value="${cle}">${t.libelle}</option>`).join("")}
        </select>
      </label>
      <label class="champ">
        <span>Montant de base (FCFA, minimum ${MONTANT_MINIMUM})</span>
        <input type="number" name="montant_base" id="champ-base-epargne" min="${MONTANT_MINIMUM}" step="1" required />
      </label>
      <div id="apercu-seuil" style="font-size:13px; color:var(--texte-secondaire)">
        Le montant de base fixe votre seuil de retrait : ${PARTS_SEUIL} fois ce montant.
      </div>
      <p style="font-size:12px; color:var(--texte-secondaire); margin:0">
        Le retrait n'est possible qu'à partir du seuil et vide tout le compte. L'association conserve 1/${PARTS_SEUIL} de votre épargne
        (part qui augmente si vous continuez à épargner au-delà du seuil).
      </p>
      <p id="erreur-ouverture-epargne" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
      <button type="submit" class="bouton bouton-or">Ouvrir mon compte</button>
    </form>
  `;

  const champBase = document.getElementById("champ-base-epargne");
  const apercu = document.getElementById("apercu-seuil");
  champBase.addEventListener("input", () => {
    const base = Number(champBase.value);
    if (!Number.isInteger(base) || base < MONTANT_MINIMUM) {
      apercu.textContent = `Le montant de base fixe votre seuil de retrait : ${PARTS_SEUIL} fois ce montant.`;
      return;
    }
    const calc = calculerEpargne(base * PARTS_SEUIL, base);
    apercu.textContent =
      `Seuil de retrait : ${formaterFCFA(calc.seuil)}. À ce seuil, vous pourrez retirer ${formaterFCFA(calc.retirable)} ` +
      `et ${formaterFCFA(calc.societe)} reviendront à l'association.`;
  });

  document.getElementById("formulaire-ouverture-epargne").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const erreur = document.getElementById("erreur-ouverture-epargne");
    erreur.hidden = true;

    const montantBase = Number(donnees.get("montant_base"));
    if (!Number.isInteger(montantBase) || montantBase < MONTANT_MINIMUM) {
      erreur.textContent = `Le montant de base doit être un nombre entier d'au moins ${MONTANT_MINIMUM} FCFA.`;
      erreur.hidden = false;
      return;
    }

    const { error } = await supabase.from("epargne_comptes").insert({
      membre_id: moiId,
      titulaire_prenom: donnees.get("prenom").trim(),
      titulaire_nom: donnees.get("nom").trim(),
      type_epargne: donnees.get("type_epargne"),
      montant_base: montantBase,
    });

    if (error) {
      erreur.textContent = "L'ouverture du compte a échoué : " + error.message;
      erreur.hidden = false;
      return;
    }

    naviguer("epargne/comptes");
  });
}

// =========================================================
// Faire un versement (déclaration, validée ensuite par le comptable)
// =========================================================
export async function ecranEpargneVerser(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Faire un versement</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { moiId, comptes } = await chargerMesDonnees();
  const comptesActifs = comptes.filter((c) => c.statut === "actif");

  if (!comptesActifs.length) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Faire un versement</h2>
      <hr class="trait-or" />
      <div class="carte">
        <p style="margin:0">Aucun de vos comptes ne peut recevoir de versement pour le moment.</p>
        <button id="bouton-aller-ouvrir" class="bouton bouton-or" style="margin-top:12px">Ouvrir un compte d'épargne</button>
      </div>
    `;
    document.getElementById("bouton-aller-ouvrir").addEventListener("click", () => naviguer("epargne/ouvrir"));
    return;
  }

  const compteInitial = comptesActifs.find((c) => c.id === comptePreselectionne) || comptesActifs[0];
  comptePreselectionne = null;

  conteneur.innerHTML = `
    <h2 class="titre-section">Faire un versement</h2>
    <hr class="trait-or" />
    <form id="formulaire-versement-epargne" class="carte" style="display:flex; flex-direction:column; gap:16px">
      <p style="margin:0; font-size:13px; color:var(--texte-secondaire)">
        Effectuez d'abord votre paiement, puis déclarez-le ici avec sa référence. Le comptable le validera, et le montant sera ajouté à votre compte.
      </p>
      ${
        comptesActifs.length > 1
          ? `<label class="champ">
              <span>Compte d'épargne</span>
              <select name="compte_id" id="select-compte-epargne" required style="${STYLE_SELECT}">
                ${comptesActifs
                  .map(
                    (c) => `<option value="${c.id}" data-base="${c.montant_base}" ${c.id === compteInitial.id ? "selected" : ""}>
                      Épargne ${libelleType(c.type_epargne).toLowerCase()} · base ${formaterFCFA(c.montant_base)}
                    </option>`
                  )
                  .join("")}
              </select>
            </label>`
          : `<input type="hidden" name="compte_id" value="${compteInitial.id}" />
             <p style="margin:-8px 0 0; color:var(--texte-secondaire)">Compte : <strong style="color:var(--texte)">Épargne ${libelleType(compteInitial.type_epargne).toLowerCase()}</strong></p>`
      }
      <label class="champ">
        <span>Montant (FCFA, minimum ${MONTANT_MINIMUM})</span>
        <input type="number" name="montant" id="champ-montant-epargne" min="${MONTANT_MINIMUM}" step="1" required value="${compteInitial.montant_base}" />
      </label>
      <label class="champ">
        <span>Date du versement</span>
        <input type="date" name="date_versement" required value="${new Date().toISOString().slice(0, 10)}" />
      </label>
      <label class="champ">
        <span>Référence du paiement (facultatif)</span>
        <input type="text" name="reference_paiement" placeholder="Numéro de transaction Mobile Money, par exemple" />
      </label>
      <p id="erreur-versement-epargne" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
      <p id="succes-versement-epargne" style="color:#4C9A6A; font-size:13px; margin:0" hidden>Versement déclaré, en attente de validation par le comptable.</p>
      <button type="submit" class="bouton bouton-or">Déclarer le versement</button>
    </form>
  `;
 
  const selectCompte = document.getElementById("select-compte-epargne");
  if (selectCompte) {
    selectCompte.addEventListener("change", () => {
      document.getElementById("champ-montant-epargne").value = selectCompte.selectedOptions[0].dataset.base;
    });
  }
 
  document.getElementById("formulaire-versement-epargne").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const erreur = document.getElementById("erreur-versement-epargne");
    const succes = document.getElementById("succes-versement-epargne");
    erreur.hidden = true;
    succes.hidden = true;
 
    const montant = Number(donnees.get("montant"));
    if (!Number.isInteger(montant) || montant < MONTANT_MINIMUM) {
      erreur.textContent = `Le montant doit être un nombre entier d'au moins ${MONTANT_MINIMUM} FCFA.`;
      erreur.hidden = false;
      return;
    }
 
    const reference = donnees.get("reference_paiement")?.trim();
    const { error } = await supabase.from("epargne_versements").insert({
      compte_id: donnees.get("compte_id"),
      membre_id: moiId,
      montant,
      date_versement: donnees.get("date_versement"),
      reference_paiement: reference || null,
    });
 
    if (error) {
      erreur.textContent = "La déclaration a échoué, réessayez.";
      erreur.hidden = false;
      return;
    }
 
    evenement.target.reset();
    succes.hidden = false;
  });
      }
