// =========================================================
// CEAI — Écran "Archives de tontine" (cycles clôturés)
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

export async function ecranTontineArchives(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Cycles de tontine clôturés</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const [{ data: cycles, error }, estAdmin] = await Promise.all([
    supabase
      .from("tontine_cycles")
      .select("id, nom, demarre_le, cloture_le")
      .eq("statut", "cloture")
      .order("cloture_le", { ascending: false }),
    jeSuisAdmin(),
  ]);

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
      <div style="display:flex; align-items:center; gap:8px">
        <button class="bouton" data-voir-id="${c.id}" data-voir-nom="${c.nom}"
                style="background:var(--fond-carte-claire); color:var(--texte); white-space:nowrap">
          Voir
        </button>
        <button class="bouton" data-cycle-id="${c.id}" data-cycle-nom="${c.nom}"
                style="background:var(--fond-carte-claire); color:var(--texte); white-space:nowrap">
          Télécharger
        </button>
        ${
          estAdmin
            ? `<button data-supprimer-cycle="${c.id}" data-supprimer-nom="${c.nom}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>`
            : ""
        }
      </div>
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

  conteneur.querySelectorAll("[data-voir-id]").forEach((bouton) => {
    bouton.addEventListener("click", () => afficherDetailCycle(conteneur, bouton.dataset.voirId, bouton.dataset.voirNom));
  });

  conteneur.querySelectorAll("[data-supprimer-cycle]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer définitivement le cycle "${bouton.dataset.supprimerNom}" des archives ? Cette action est irréversible.`)) return;
      const { error } = await supabase.from("tontine_cycles").delete().eq("id", bouton.dataset.supprimerCycle);
      if (error) {
        alert("Erreur : " + error.message);
        return;
      }
      ecranTontineArchives(conteneur);
    });
  });
}

async function afficherDetailCycle(conteneur, cycleId, nomCycle) {
  conteneur.innerHTML = `<h2 class="titre-section">${nomCycle}</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { participants, versements } = await recupererDonneesCycle(cycleId);
  const { data: bilan } = await supabase
    .from("tontine_bilans")
    .select("montant_recu, notes, beneficiaire_participant_id")
    .eq("cycle_id", cycleId)
    .maybeSingle();
  const beneficiaire = bilan ? participants.find((p) => p.id === bilan.beneficiaire_participant_id) : null;

  const lignesParticipants = participants
    .map(
      (p) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-top:1px solid var(--bordure)">
        <p style="margin:0; font-size:13px">${p.ordre_tour}. ${p.nom}</p>
        <p style="margin:0; font-size:12px; color:var(--texte-secondaire)">${p.a_recu ? "A reçu le " + formaterDate(p.recu_le) : "N'a pas reçu"}</p>
      </div>
    `
    )
    .join("");

  const lignesVersements = versements
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
    <h2 class="titre-section">${nomCycle}</h2>
    <hr class="trait-or" />
    <button id="bouton-retour-archive-tontine" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); margin-bottom:16px">
      ← Retour aux archives
    </button>

    ${
      bilan
        ? `<div class="carte" style="background:var(--fond-carte-claire)">
             <p style="margin:0 0 8px; font-weight:500">Bilan de clôture</p>
             <p style="margin:0; font-size:13px"><strong>${beneficiaire?.nom || "—"}</strong> a reçu le tour${bilan.montant_recu ? " · " + Number(bilan.montant_recu).toLocaleString("fr-FR") + " FCFA" : ""}</p>
             ${bilan.notes ? `<p style="margin:8px 0 0; font-size:13px; color:var(--texte-secondaire); white-space:pre-line">${bilan.notes}</p>` : ""}
           </div>`
        : ""
    }

    <div class="carte" style="margin-top:12px">
      <p style="margin:0 0 8px; font-weight:500">Participants et ordre de passage</p>
      ${lignesParticipants || `<p style="color:var(--texte-secondaire); font-size:13px">Aucun participant.</p>`}
    </div>

    <div class="carte" style="margin-top:12px">
      <p style="margin:0 0 8px; font-weight:500">Versements</p>
      ${lignesVersements || `<p style="color:var(--texte-secondaire); font-size:13px">Aucun versement.</p>`}
    </div>
  `;

  document.getElementById("bouton-retour-archive-tontine").addEventListener("click", () => ecranTontineArchives(conteneur));
}

async function recupererDonneesCycle(cycleId) {
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

  const { data: versementsBruts } = await supabase
    .from("tontine_versements")
    .select("participant_id, montant, date_versement, statut")
    .eq("cycle_id", cycleId)
    .order("date_versement");

  return {
    participants: (participants || [])
      .sort((a, b) => a.ordre_tour - b.ordre_tour)
      .map((p) => ({ ...p, nom: nomParId[p.membre_id] || p.membre_id })),
    versements: (versementsBruts || []).map((v) => ({ ...v, nom: nomParParticipantId[v.participant_id] || v.participant_id })),
  };
}

async function telechargerCycle(cycleId, nomCycle, boutonDeclencheur) {
  boutonDeclencheur.disabled = true;
  const texteInitial = boutonDeclencheur.textContent;
  boutonDeclencheur.textContent = "Préparation…";

  const { participants, versements } = await recupererDonneesCycle(cycleId);

  const entetesParticipants = ["Membre", "Position", "A reçu", "Date de réception"];
  const lignesParticipants = participants.map((p) => [p.nom, p.ordre_tour, p.a_recu ? "Oui" : "Non", p.recu_le || ""]);

  const entetesVersements = ["Membre", "Montant (FCFA)", "Date", "Statut"];
  const lignesVersements = versements.map((v) => [v.nom, v.montant, v.date_versement, v.statut]);

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
