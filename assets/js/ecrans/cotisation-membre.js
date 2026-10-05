// =========================================================
// CEAI — Écrans "Cotisation" (côté membre)
// Chaque session ouverte s'affiche sous forme de carte à thème
// (choisi par l'admin). Plusieurs sessions peuvent être ouvertes
// ensemble : le membre touche celle qu'il veut rejoindre, puis
// choisit la session concernée pour chaque versement.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";
import {
  carteOuverture,
  activerCartesOuverture,
  carteStat,
  resoudreTheme,
  echapper,
  formaterMontant,
} from "./composants-tableau.js";

// Session à présélectionner quand on touche une carte déjà adhérée
let sessionPreselectionnee = null;

function naviguer(route) {
  window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: route }));
}

function badgeStatut(statut) {
  const libelles = { en_attente: "En attente", valide: "Validé", rejete: "Rejeté" };
  const couleurs = {
    en_attente: "var(--or-texte)",
    valide: "#4C9A6A",
    rejete: "var(--danger)",
  };
  return `<span style="font-size:11px; color:${couleurs[statut] || "var(--texte-secondaire)"};
          border:1px solid currentColor; padding:2px 8px; border-radius:999px">${libelles[statut] || statut}</span>`;
}

function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

async function recupererContexte() {
  const moiId = await idProfilCourant();

  const [{ data: sessionsOuvertes }, { data: mesAdhesions }] = await Promise.all([
    supabase
      .from("cotisation_sessions")
      .select("id, nom, montant_indicatif, theme")
      .eq("statut", "ouverte")
      .order("ouverte_le", { ascending: false }),
    supabase.from("cotisation_adhesions").select("session_id").eq("membre_id", moiId).not("session_id", "is", null),
  ]);

  return { moiId, sessionsOuvertes: sessionsOuvertes || [], mesAdhesions: mesAdhesions || [] };
}

function rendreRedirectionAdhesion(conteneur, titre) {
  conteneur.innerHTML = `
    <h2 class="titre-section">${titre}</h2>
    <hr class="trait-or" />
    <div class="carte">
      <p style="margin:0">Vous devez d'abord adhérer à une session de cotisation.</p>
      <button id="bouton-aller-adherer" class="bouton bouton-or" style="margin-top:12px">Adhérer à la cotisation</button>
    </div>
  `;
  document.getElementById("bouton-aller-adherer").addEventListener("click", () => naviguer("cotisation/adherer"));
}

// =========================================================
// Adhérer à la cotisation
// =========================================================
export async function ecranCotisationAdherer(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Adhérer à la cotisation</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { moiId, sessionsOuvertes, mesAdhesions } = await recupererContexte();

  if (!sessionsOuvertes.length) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Adhérer à la cotisation</h2>
      <hr class="trait-or" />
      <p style="color:var(--texte-secondaire)">Aucune session de cotisation n'est actuellement ouverte.</p>
    `;
    return;
  }

  const idsAdheres = new Set(mesAdhesions.map((a) => a.session_id));

  const cartes = sessionsOuvertes
    .map((s) => {
      const dejaAdhere = idsAdheres.has(s.id);
      return carteOuverture({
        nom: s.nom,
        theme: s.theme,
        badge: dejaAdhere ? "Adhéré" : "",
        details: [
          s.montant_indicatif ? `Montant indicatif : ${formaterMontant(s.montant_indicatif)}` : "Montant libre",
          dejaAdhere ? "Toucher pour faire un versement" : "Toucher pour adhérer",
        ],
        attributs: `data-session="${s.id}" role="button" tabindex="0"`,
        classes: "ouverture-cliquable",
      });
    })
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Adhérer à la cotisation</h2>
    <hr class="trait-or" />
    <p class="intro-ouvertures">Plusieurs sessions peuvent être ouvertes en même temps. Touchez celle qui vous intéresse.</p>
    <div class="grille-ouvertures">${cartes}</div>
  `;

  activerCartesOuverture(conteneur, "data-session", async (sessionId) => {
    const session = sessionsOuvertes.find((s) => s.id === sessionId);

    if (idsAdheres.has(sessionId)) {
      sessionPreselectionnee = sessionId;
      naviguer("cotisation/verser");
      return;
    }

    if (!window.confirm(`Confirmer votre adhésion à la session "${session.nom}" ?`)) return;

    const { error } = await supabase.from("cotisation_adhesions").insert({
      membre_id: moiId,
      session_id: session.id,
    });

    if (error) {
      alert("Erreur : " + error.message);
      return;
    }

    notifier(`Un nouveau membre a adhéré à la session "${session.nom}".`);
    ecranCotisationAdherer(conteneur);
  });
}

// =========================================================
// Suivi de mes cotisations
// =========================================================
export async function ecranCotisationSuivi(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Suivi de mes cotisations</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const moiId = await idProfilCourant();

  const { data: versements } = await supabase
    .from("cotisation_versements")
    .select("id, montant, date_versement, statut, cotisation_sessions(nom, theme)")
    .eq("membre_id", moiId)
    .order("date_versement", { ascending: false });

  const liste = versements || [];
  const valides = liste.filter((v) => v.statut === "valide");
  const total = valides.reduce((somme, v) => somme + Number(v.montant), 0);

  const lignes = liste
    .map((v) => {
      const couleur = resoudreTheme(v.cotisation_sessions?.theme).c1;
      return `
    <div class="carte" style="display:flex; justify-content:space-between; align-items:center; border-left:4px solid ${couleur}">
      <div>
        <p style="margin:0; font-weight:500">${formaterMontant(v.montant)}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${formaterDate(v.date_versement)} · ${echapper(v.cotisation_sessions?.nom || "—")}
        </p>
      </div>
      <div style="display:flex; align-items:center; gap:8px">
        ${badgeStatut(v.statut)}
        ${v.statut !== "valide" ? `<button data-supprimer-versement="${v.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>` : ""}
      </div>
    </div>`;
    })
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Suivi de mes cotisations</h2>
    <hr class="trait-or" />
    <div style="margin:16px 0">
      ${carteStat({
        libelle: "Total validé",
        valeur: formaterMontant(total),
        note: `${valides.length} versement${valides.length > 1 ? "s" : ""} validé${valides.length > 1 ? "s" : ""}`,
        icone: "cotisation",
        couleur: "vert",
      })}
    </div>
    ${liste.length ? lignes : `<p style="color:var(--texte-secondaire)">Aucun versement déclaré pour le moment.</p>`}
  `;

  conteneur.querySelectorAll("[data-supprimer-versement]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm("Supprimer ce versement ?")) return;
      await supabase.from("cotisation_versements").delete().eq("id", bouton.dataset.supprimerVersement);
      ecranCotisationSuivi(conteneur);
    });
  });
}

// =========================================================
// Faire mon versement
// =========================================================
export async function ecranCotisationVerser(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Faire mon versement</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { moiId, sessionsOuvertes, mesAdhesions } = await recupererContexte();

  const idsAdheres = new Set(mesAdhesions.map((a) => a.session_id));
  const sessionsAdherees = sessionsOuvertes.filter((s) => idsAdheres.has(s.id));

  if (!sessionsAdherees.length) {
    rendreRedirectionAdhesion(conteneur, "Faire mon versement");
    return;
  }

  const sessionInitiale = sessionsAdherees.find((s) => s.id === sessionPreselectionnee) || sessionsAdherees[0];
  sessionPreselectionnee = null;

  const cartes = sessionsAdherees
    .map((s) =>
      carteOuverture({
        nom: s.nom,
        theme: s.theme,
        details: [s.montant_indicatif ? `Montant indicatif : ${formaterMontant(s.montant_indicatif)}` : "Montant libre"],
        attributs: `data-choisir-session="${s.id}" role="button" tabindex="0"`,
        classes: `ouverture-cliquable ${s.id === sessionInitiale.id ? "selectionnee" : ""}`,
      })
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Faire mon versement</h2>
    <hr class="trait-or" />
    <p class="intro-ouvertures">${sessionsAdherees.length > 1 ? "Choisissez la session concernée par votre versement." : "Session concernée par votre versement :"}</p>
    <div class="grille-ouvertures">${cartes}</div>
    <form id="formulaire-versement" class="carte" style="display:flex; flex-direction:column; gap:16px">
      <input type="hidden" name="session_id" id="champ-session-versement" value="${sessionInitiale.id}" />
      <label class="champ">
        <span>Montant (FCFA)</span>
        <input type="number" name="montant" min="1" step="1" required id="champ-montant-cotisation" value="${sessionInitiale.montant_indicatif || ""}" />
      </label>
      <label class="champ">
        <span>Date du versement</span>
        <input type="date" name="date_versement" required value="${new Date().toISOString().slice(0, 10)}" />
      </label>
      <p id="erreur-versement" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
      <p id="succes-versement" style="color:#4C9A6A; font-size:13px; margin:0" hidden>Versement déclaré, en attente de validation par un admin.</p>
      <button type="submit" class="bouton bouton-or">Déclarer le versement</button>
    </form>
  `;

  activerCartesOuverture(conteneur, "data-choisir-session", (sessionId, carte) => {
    conteneur.querySelectorAll("[data-choisir-session]").forEach((c) => c.classList.remove("selectionnee"));
    carte.classList.add("selectionnee");
    document.getElementById("champ-session-versement").value = sessionId;
    const session = sessionsAdherees.find((s) => s.id === sessionId);
    document.getElementById("champ-montant-cotisation").value = session?.montant_indicatif || "";
  });

  document.getElementById("formulaire-versement").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const erreur = document.getElementById("erreur-versement");
    const succes = document.getElementById("succes-versement");
    erreur.hidden = true;
    succes.hidden = true;

    const { error } = await supabase.from("cotisation_versements").insert({
      session_id: donnees.get("session_id"),
      membre_id: moiId,
      montant: Number(donnees.get("montant")),
      date_versement: donnees.get("date_versement"),
    });

    if (error) {
      erreur.textContent = "La déclaration a échoué, réessayez.";
      erreur.hidden = false;
      return;
    }

    const montantDeclare = donnees.get("montant");
    const sessionIdChoisie = donnees.get("session_id");
    evenement.target.reset();
    document.getElementById("champ-session-versement").value = sessionIdChoisie;
    succes.hidden = false;
    notifier(`Un versement de cotisation a été déclaré (${montantDeclare} FCFA).`);
  });
    }
