// =========================================================
// CEAI — Écran "Archives de tontine" (cycles clôturés)
// =========================================================
import { supabase } from "../supabase-client.js";

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export async function ecranTontineArchives(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Cycles de tontine clôturés</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { data: cycles, error } = await supabase
    .from("tontine_cycles")
    .select("id, nom, demarre_le, cloture_le")
    .eq("statut", "cloture")
    .order("cloture_le", { ascending: false });

  if (error) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Cycles de tontine clôturés</h2>
      <hr class="trait-or" />
      <p style="color:var(--danger)">Impossible de charger les archives pour le moment.</p>
    `;
    return;
  }

  const cartes = (cycles || [])
    .map(
      (c) => `
    <div class="carte" style="display:flex; justify-content:space-between; align-items:center; gap:12px">
      <div>
        <p style="margin:0; font-weight:500">${c.nom}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          Démarré le ${formaterDate(c.demarre_le)} · Clôturé le ${formaterDate(c.cloture_le)}
        </p>
      </div>
      <button class="bouton" data-cycle-id="${c.id}" data-cycle-nom="${c.nom}"
              style="background:var(--fond-carte-claire); color:var(--texte); white-space:nowrap">
        Télécharger
      </button>
    </div>
  `
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Cycles de tontine clôturés</h2>
    <hr class="trait-or" />
    ${cycles && cycles.length ? cartes : `<p style="color:var(--texte-secondaire)">Aucun cycle clôturé pour le moment.</p>`}
  `;

  conteneur.querySelectorAll("[data-cycle-id]").forEach((bouton) => {
    bouton.addEventListener("click", () => telechargerCycle(bouton.dataset.cycleId, bouton.dataset.cycleNom, bouton));
  });
}

async function telechargerCycle(cycleId, nomCycle, boutonDeclencheur) {
  boutonDeclencheur.disabled = true;
  const texteInitial = boutonDeclencheur.textContent;
  boutonDeclencheur.textContent = "Préparation…";

  const { data: participants } = await supabase
    .from("tontine_participants")
    .select("id, membre_id, ordre_tour, a_recu, recu_le")
    .eq("cycle_id", cycleId);

  const idsMembres = [...new Set((participants || []).map((p) => p.membre_id))];
  const { data: membres } = idsMembres.length
    ? await supabase.from("profils").select("id, nom").in("id", idsMembres)
    : { data: [] };
  const nomParId = Object.fromEntries((membres || []).map((m) => [m.id, m.nom]));
  const nomParParticipantId = Object.fromEntries((participants || []).map((p) => [p.id, nomParId[p.membre_id] || p.membre_id]));

  const { data: versements } = await supabase
    .from("tontine_versements")
    .select("participant_id, montant, date_versement, statut")
    .eq("cycle_id", cycleId)
    .order("date_versement");

  const entetesParticipants = ["Membre", "Position", "A reçu", "Date de réception"];
  const lignesParticipants = (participants || [])
    .sort((a, b) => a.ordre_tour - b.ordre_tour)
    .map((p) => [nomParId[p.membre_id] || p.membre_id, p.ordre_tour, p.a_recu ? "Oui" : "Non", p.recu_le || ""]);

  const entetesVersements = ["Membre", "Montant (FCFA)", "Date", "Statut"];
  const lignesVersements = (versements || []).map((v) => [
    nomParParticipantId[v.participant_id] || v.participant_id,
    v.montant,
    v.date_versement,
    v.statut,
  ]);

  const echapper = (valeur) => `"${String(valeur).replace(/"/g, '""')}"`;
  const csv = [
    ["PARTICIPANTS ET ORDRE DE PASSAGE"],
    entetesParticipants,
    ...lignesParticipants,
    [],
    ["VERSEMENTS"],
    entetesVersements,
    ...lignesVersements,
  ]
    .map((ligne) => ligne.map(echapper).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = `tontine-${nomCycle.replace(/\s+/g, "-")}.csv`;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);

  boutonDeclencheur.disabled = false;
  boutonDeclencheur.textContent = texteInitial;
      }
