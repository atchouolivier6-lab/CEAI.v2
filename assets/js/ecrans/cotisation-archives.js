// =========================================================
// CEAI — Écran "Archives de cotisation" (sessions clôturées)
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

async function jeSuisAdmin() {
  const moiId = await idProfilCourant();
  const { data } = await supabase.from("profils").select("role").eq("id", moiId).single();
  return data?.role === "admin";
}

export async function ecranCotisationArchives(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Sessions de cotisation clôturées</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const [{ data: sessions, error }, estAdmin] = await Promise.all([
    supabase
      .from("cotisation_sessions")
      .select("id, nom, ouverte_le, cloturee_le")
      .eq("statut", "cloturee")
      .order("cloturee_le", { ascending: false }),
    jeSuisAdmin(),
  ]);

  if (error) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Sessions de cotisation clôturées</h2>
      <hr class="trait-or" />
      <p style="color:var(--danger)">Impossible de charger les archives pour le moment.</p>
    `;
    return;
  }

  const cartes = (sessions || [])
    .map(
      (s) => `
    <div class="carte" style="display:flex; justify-content:space-between; align-items:center; gap:12px">
      <div>
        <p style="margin:0; font-weight:500">${s.nom}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          Ouverte le ${formaterDate(s.ouverte_le)} · Clôturée le ${formaterDate(s.cloturee_le)}
        </p>
      </div>
      <div style="display:flex; align-items:center; gap:8px">
        <button class="bouton" data-voir-id="${s.id}" data-voir-nom="${s.nom}"
                style="background:var(--fond-carte-claire); color:var(--texte); white-space:nowrap">
          Voir
        </button>
        <button class="bouton" data-session-id="${s.id}" data-session-nom="${s.nom}"
                style="background:var(--fond-carte-claire); color:var(--texte); white-space:nowrap">
          Télécharger
        </button>
        ${
          estAdmin
            ? `<button data-supprimer-session="${s.id}" data-supprimer-nom="${s.nom}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>`
            : ""
        }
      </div>
    </div>
  `
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Sessions de cotisation clôturées</h2>
    <hr class="trait-or" />
    ${sessions && sessions.length ? cartes : `<p style="color:var(--texte-secondaire)">Aucune session clôturée pour le moment.</p>`}
  `;

  conteneur.querySelectorAll("[data-session-id]").forEach((bouton) => {
    bouton.addEventListener("click", () => telechargerSession(bouton.dataset.sessionId, bouton.dataset.sessionNom, bouton));
  });

  conteneur.querySelectorAll("[data-voir-id]").forEach((bouton) => {
    bouton.addEventListener("click", () => afficherDetailSession(conteneur, bouton.dataset.voirId, bouton.dataset.voirNom));
  });

  conteneur.querySelectorAll("[data-supprimer-session]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer définitivement la session "${bouton.dataset.supprimerNom}" des archives ? Cette action est irréversible.`)) return;
      const { error } = await supabase.from("cotisation_sessions").delete().eq("id", bouton.dataset.supprimerSession);
      if (error) {
        alert("Erreur : " + error.message);
        return;
      }
      ecranCotisationArchives(conteneur);
    });
  });
}

async function afficherDetailSession(conteneur, sessionId, nomSession) {
  conteneur.innerHTML = `<h2 class="titre-section">${nomSession}</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const versements = await recupererVersementsSession(sessionId);
  const total = versements.filter((v) => v.statut === "valide").reduce((s, v) => s + Number(v.montant), 0);
  const { data: bilan } = await supabase
    .from("cotisation_bilans")
    .select("depenses_montant, depenses_description, remboursements_montant, remboursements_description, realisations_montant, realisations_description")
    .eq("session_id", sessionId)
    .maybeSingle();

  const lignes = versements
    .map(
      (v) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-top:1px solid var(--bordure)">
        <p style="margin:0; font-size:13px">${v.nom}</p>
        <p style="margin:0; font-size:13px">${Number(v.montant).toLocaleString("fr-FR")} FCFA · ${formaterDate(v.date_versement)} · ${v.statut}</p>
      </div>
    `
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">${nomSession}</h2>
    <hr class="trait-or" />
    <button id="bouton-retour-archive-cotisation" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); margin-bottom:16px">
      ← Retour aux archives
    </button>

    <div class="carte" style="text-align:center">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Total validé</p>
      <p style="font-family:var(--police-titre); font-size:26px; margin:0">${total.toLocaleString("fr-FR")} FCFA</p>
    </div>

    ${
      bilan
        ? `<div class="carte" style="margin-top:12px; background:var(--fond-carte-claire)">
             <p style="margin:0 0 10px; font-weight:500">Bilan de clôture</p>
             ${gabaritLigneBilan("Dépenses", bilan.depenses_montant, bilan.depenses_description)}
             ${gabaritLigneBilan("Remboursements de prêts", bilan.remboursements_montant, bilan.remboursements_description)}
             ${gabaritLigneBilan("Réalisations", bilan.realisations_montant, bilan.realisations_description)}
           </div>`
        : ""
    }

    <div class="carte" style="margin-top:12px">
      <p style="margin:0 0 8px; font-weight:500">Versements</p>
      ${lignes || `<p style="color:var(--texte-secondaire); font-size:13px">Aucun versement.</p>`}
    </div>
  `;

  document.getElementById("bouton-retour-archive-cotisation").addEventListener("click", () => ecranCotisationArchives(conteneur));
}

function gabaritLigneBilan(libelle, montant, description) {
  return `
    <div style="padding:8px 0; border-top:1px solid var(--bordure)">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <p style="margin:0; font-size:13px">${libelle}</p>
        <p style="margin:0; font-size:13px; font-weight:500">${Number(montant || 0).toLocaleString("fr-FR")} FCFA</p>
      </div>
      ${description ? `<p style="margin:4px 0 0; font-size:12px; color:var(--texte-secondaire)">${description}</p>` : ""}
    </div>
  `;
}

async function recupererVersementsSession(sessionId) {
  const { data: versements } = await supabase
    .from("cotisation_versements")
    .select("membre_id, montant, date_versement, statut")
    .eq("session_id", sessionId)
    .order("date_versement");

  const idsMembres = [...new Set((versements || []).map((v) => v.membre_id))];
  const { data: membres } = idsMembres.length
    ? await supabase.from("profils").select("id, nom").in("id", idsMembres)
    : { data: [] };
  const nomParId = Object.fromEntries((membres || []).map((m) => [m.id, m.nom]));

  return (versements || []).map((v) => ({ ...v, nom: nomParId[v.membre_id] || v.membre_id }));
}

async function telechargerSession(sessionId, nomSession, boutonDeclencheur) {
  boutonDeclencheur.disabled = true;
  const texteInitial = boutonDeclencheur.textContent;
  boutonDeclencheur.textContent = "Préparation…";

  const versements = await recupererVersementsSession(sessionId);

  const entetes = ["Membre", "Montant (FCFA)", "Date", "Statut"];
  const lignes = versements.map((v) => [v.nom, v.montant, v.date_versement, v.statut]);

  const csv = [entetes, ...lignes]
    .map((ligne) => ligne.map((valeur) => `"${String(valeur).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = `cotisation-${nomSession.replace(/\s+/g, "-")}.csv`;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);

  boutonDeclencheur.disabled = false;
  boutonDeclencheur.textContent = texteInitial;
    }
