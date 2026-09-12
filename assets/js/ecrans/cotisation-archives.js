// =========================================================
// CEAI — Écran "Archives de cotisation" (sessions clôturées)
// =========================================================
import { supabase } from "../supabase-client.js";

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export async function ecranCotisationArchives(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Sessions de cotisation clôturées</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { data: sessions, error } = await supabase
    .from("cotisation_sessions")
    .select("id, nom, ouverte_le, cloturee_le")
    .eq("statut", "cloturee")
    .order("cloturee_le", { ascending: false });

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
      <button class="bouton" data-session-id="${s.id}" data-session-nom="${s.nom}"
              style="background:var(--fond-carte-claire); color:var(--texte); white-space:nowrap">
        Télécharger
      </button>
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
}

async function telechargerSession(sessionId, nomSession, boutonDeclencheur) {
  boutonDeclencheur.disabled = true;
  const texteInitial = boutonDeclencheur.textContent;
  boutonDeclencheur.textContent = "Préparation…";

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

  const entetes = ["Membre", "Montant (FCFA)", "Date", "Statut"];
  const lignes = (versements || []).map((v) => [
    nomParId[v.membre_id] || v.membre_id,
    v.montant,
    v.date_versement,
    v.statut,
  ]);

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
