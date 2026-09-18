// =========================================================
// CEAI — Écrans "Cotisation" (côté membre)
// L'adhésion se fait désormais par session (comme rejoindre un
// cycle de tontine) : un membre choisit à quelle(s) session(s)
// il adhère, plusieurs sessions pouvant être ouvertes ensemble.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";

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
    supabase.from("cotisation_sessions").select("id, nom, montant_indicatif").eq("statut", "ouverte").order("ouverte_le", { ascending: false }),
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
  document.getElementById("bouton-aller-adherer").addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: "cotisation/adherer" }));
  });
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

  conteneur.innerHTML = `
    <h2 class="titre-section">Adhérer à la cotisation</h2>
    <hr class="trait-or" />
    ${sessionsOuvertes.map((s) => gabaritSessionAAdherer(s, idsAdheres.has(s.id))).join("")}
  `;

  conteneur.querySelectorAll("[data-adherer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const session = sessionsOuvertes.find((s) => s.id === bouton.dataset.adherer);
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
  });
}

function gabaritSessionAAdherer(session, dejaAdhere) {
  return `
    <div class="carte">
      <p style="margin:0"><strong>${session.nom}</strong></p>
      ${session.montant_indicatif ? `<p style="color:var(--texte-secondaire); font-size:13px; margin:4px 0 12px">Montant indicatif : ${Number(session.montant_indicatif).toLocaleString("fr-FR")} FCFA</p>` : `<div style="margin-bottom:12px"></div>`}
      ${
        dejaAdhere
          ? `<p style="margin:0; font-size:13px; color:#4C9A6A">Vous avez déjà adhéré à cette session</p>`
          : `<button data-adherer="${session.id}" class="bouton bouton-or">Adhérer à cette session</button>`
      }
    </div>
  `;
}

// =========================================================
// Suivi de mes cotisations
// =========================================================
export async function ecranCotisationSuivi(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Suivi de mes cotisations</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const moiId = await idProfilCourant();

  const { data: versements } = await supabase
    .from("cotisation_versements")
    .select("id, montant, date_versement, statut, cotisation_sessions(nom)")
    .eq("membre_id", moiId)
    .order("date_versement", { ascending: false });

  const total = (versements || [])
    .filter((v) => v.statut === "valide")
    .reduce((somme, v) => somme + Number(v.montant), 0);

  const lignes = (versements || [])
    .map(
      (v) => `
    <div class="carte" style="display:flex; justify-content:space-between; align-items:center">
      <div>
        <p style="margin:0; font-weight:500">${Number(v.montant).toLocaleString("fr-FR")} FCFA</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${formaterDate(v.date_versement)} · ${v.cotisation_sessions?.nom || "—"}
        </p>
      </div>
      <div style="display:flex; align-items:center; gap:8px">
        ${badgeStatut(v.statut)}
        ${v.statut !== "valide" ? `<button data-supprimer-versement="${v.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>` : ""}
      </div>
    </div>
  `
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Suivi de mes cotisations</h2>
    <hr class="trait-or" />
    <div class="carte" style="text-align:center">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Total validé</p>
      <p style="font-family:var(--police-titre); font-size:26px; margin:0">${total.toLocaleString("fr-FR")} FCFA</p>
    </div>
    ${versements && versements.length ? lignes : `<p style="color:var(--texte-secondaire)">Aucun versement déclaré pour le moment.</p>`}
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

  conteneur.innerHTML = `
    <h2 class="titre-section">Faire mon versement</h2>
    <hr class="trait-or" />
    <form id="formulaire-versement" class="carte" style="display:flex; flex-direction:column; gap:16px">
      ${
        sessionsAdherees.length > 1
          ? `<label class="champ">
              <span>Session</span>
              <select name="session_id" id="select-session-versement" required style="background:var(--fond); border:1px solid var(--bordure);
                      border-radius:var(--rayon-petit); padding:11px 12px; color:var(--texte); font-family:inherit; font-size:15px">
                ${sessionsAdherees.map((s) => `<option value="${s.id}" data-montant="${s.montant_indicatif || ""}">${s.nom}</option>`).join("")}
              </select>
            </label>`
          : `<input type="hidden" name="session_id" value="${sessionsAdherees[0].id}" />
             <p style="color:var(--texte-secondaire); margin:-8px 0 0">Session en cours : <strong style="color:var(--texte)">${sessionsAdherees[0].nom}</strong></p>`
      }
      <label class="champ">
        <span>Montant (FCFA)</span>
        <input type="number" name="montant" min="1" step="1" required id="champ-montant-cotisation" value="${sessionsAdherees[0].montant_indicatif || ""}" />
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

  const selectSession = document.getElementById("select-session-versement");
  if (selectSession) {
    selectSession.addEventListener("change", () => {
      document.getElementById("champ-montant-cotisation").value = selectSession.selectedOptions[0].dataset.montant;
    });
  }

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

    evenement.target.reset();
    succes.hidden = false;
    notifier(`Un versement de cotisation a été déclaré (${donnees.get("montant")} FCFA).`);
  });
          }
