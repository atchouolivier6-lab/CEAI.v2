// =========================================================
// CEAI — Écran admin "Gestion des cotisations"
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export async function ecranAdminCotisations(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion des cotisations</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const moiId = await idProfilCourant();

  const { data: sessionOuverte } = await supabase
    .from("cotisation_sessions")
    .select("id, nom, ouverte_le")
    .eq("statut", "ouverte")
    .maybeSingle();

  if (!sessionOuverte) {
    rendreFormulaireOuverture(conteneur, moiId);
    return;
  }

  const { data: versements } = await supabase
    .from("cotisation_versements")
    .select("id, montant, date_versement, statut, profils(nom)")
    .eq("session_id", sessionOuverte.id)
    .order("date_versement", { ascending: false });

  const totalValide = (versements || [])
    .filter((v) => v.statut === "valide")
    .reduce((s, v) => s + Number(v.montant), 0);

  const enAttente = (versements || []).filter((v) => v.statut === "en_attente");
  const traites = (versements || []).filter((v) => v.statut !== "en_attente");

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion des cotisations</h2>
    <hr class="trait-or" />

    <div class="carte">
      <p style="margin:0; font-weight:500">${sessionOuverte.nom}</p>
      <p style="margin:4px 0 12px; font-size:13px; color:var(--texte-secondaire)">
        Ouverte le ${formaterDate(sessionOuverte.ouverte_le)} · Total validé : ${totalValide.toLocaleString("fr-FR")} FCFA
      </p>
      <button id="bouton-cloturer-session" class="bouton" style="background:var(--danger); color:#fff">Clôturer cette session</button>
    </div>

    <p style="font-weight:500; margin:20px 0 8px">Versements en attente (${enAttente.length})</p>
    ${
      enAttente.length
        ? enAttente.map((v) => gabaritVersementEnAttente(v)).join("")
        : `<p style="color:var(--texte-secondaire); font-size:14px">Aucun versement en attente.</p>`
    }

    ${
      traites.length
        ? `<p style="font-weight:500; margin:20px 0 8px">Traités récemment</p>` +
          traites.slice(0, 10).map((v) => gabaritVersementTraite(v)).join("")
        : ""
    }
  `;

  document.getElementById("bouton-cloturer-session").addEventListener("click", async () => {
    if (!window.confirm(`Clôturer "${sessionOuverte.nom}" ? Cette action est définitive : plus aucun versement ne pourra être modifié.`)) return;

    await supabase
      .from("cotisation_sessions")
      .update({ statut: "cloturee", cloturee_par: moiId, cloturee_le: new Date().toISOString() })
      .eq("id", sessionOuverte.id);

    ecranAdminCotisations(conteneur);
  });

  conteneur.querySelectorAll("[data-valider]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("cotisation_versements")
        .update({ statut: "valide", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.valider);
      ecranAdminCotisations(conteneur);
    });
  });

  conteneur.querySelectorAll("[data-rejeter]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("cotisation_versements")
        .update({ statut: "rejete", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.rejeter);
      ecranAdminCotisations(conteneur);
    });
  });
}

function gabaritVersementEnAttente(v) {
  return `
    <div class="carte" style="display:flex; justify-content:space-between; align-items:center; gap:10px">
      <div>
        <p style="margin:0; font-weight:500">${v.profils?.nom || "—"}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${Number(v.montant).toLocaleString("fr-FR")} FCFA · ${formaterDate(v.date_versement)}
        </p>
      </div>
      <div style="display:flex; gap:6px">
        <button data-valider="${v.id}" class="bouton" style="background:#4C9A6A; color:#fff; padding:8px 12px; font-size:13px">Valider</button>
        <button data-rejeter="${v.id}" class="bouton" style="background:var(--danger); color:#fff; padding:8px 12px; font-size:13px">Rejeter</button>
      </div>
    </div>
  `;
}

function gabaritVersementTraite(v) {
  const couleur = v.statut === "valide" ? "#4C9A6A" : "var(--danger)";
  const libelle = v.statut === "valide" ? "Validé" : "Rejeté";
  return `
    <div class="carte" style="display:flex; justify-content:space-between; align-items:center; opacity:0.8">
      <div>
        <p style="margin:0; font-size:14px">${v.profils?.nom || "—"}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${Number(v.montant).toLocaleString("fr-FR")} FCFA · ${formaterDate(v.date_versement)}
        </p>
      </div>
      <span style="font-size:11px; color:${couleur}; border:1px solid currentColor; padding:2px 8px; border-radius:999px">${libelle}</span>
    </div>
  `;
}

function rendreFormulaireOuverture(conteneur, moiId) {
  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion des cotisations</h2>
    <hr class="trait-or" />
    <div class="carte">
      <p style="margin:0 0 12px; color:var(--texte-secondaire)">Aucune session de cotisation n'est actuellement ouverte.</p>
      <form id="formulaire-ouverture-session" style="display:flex; flex-direction:column; gap:12px">
        <label class="champ">
          <span>Nom de la session (ex: Janvier 2026)</span>
          <input type="text" name="nom" required />
        </label>
        <p id="erreur-ouverture" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
        <button type="submit" class="bouton bouton-or">Ouvrir la session</button>
      </form>
    </div>
  `;

  document.getElementById("formulaire-ouverture-session").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const nom = new FormData(evenement.target).get("nom").trim();
    const erreur = document.getElementById("erreur-ouverture");

    const { error } = await supabase.from("cotisation_sessions").insert({ nom, ouverte_par: moiId });

    if (error) {
      erreur.textContent = "Impossible d'ouvrir la session, réessayez.";
      erreur.hidden = false;
      return;
    }

    ecranAdminCotisations(conteneur);
  });
}
