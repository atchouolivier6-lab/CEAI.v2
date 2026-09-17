// =========================================================
// CEAI — Écrans "Tontine" (côté membre)
// Plusieurs cycles peuvent être ouverts en même temps : un
// membre peut en rejoindre plusieurs.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";

function badgeStatut(statut) {
  const libelles = { en_attente: "En attente", valide: "Validé", rejete: "Rejeté" };
  const couleurs = { en_attente: "var(--or-texte)", valide: "#4C9A6A", rejete: "var(--danger)" };
  return `<span style="font-size:11px; color:${couleurs[statut] || "var(--texte-secondaire)"};
          border:1px solid currentColor; padding:2px 8px; border-radius:999px">${libelles[statut] || statut}</span>`;
}

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

async function recupererContexte() {
  const moiId = await idProfilCourant();

  const [{ data: cyclesOuverts }, { data: mesParticipations }] = await Promise.all([
    supabase.from("tontine_cycles").select("id, nom, montant_mensuel").eq("statut", "ouvert").order("demarre_le", { ascending: false }),
    supabase.from("tontine_participants").select("id, cycle_id, ordre_tour, a_recu").eq("membre_id", moiId),
  ]);

  return { moiId, cyclesOuverts: cyclesOuverts || [], mesParticipations: mesParticipations || [] };
}

function rendreRedirectionRejoindre(conteneur, titre) {
  conteneur.innerHTML = `
    <h2 class="titre-section">${titre}</h2>
    <hr class="trait-or" />
    <div class="carte">
      <p style="margin:0">Vous devez d'abord rejoindre un cycle de tontine en cours.</p>
      <button id="bouton-aller-rejoindre" class="bouton bouton-or" style="margin-top:12px">Rejoindre la tontine</button>
    </div>
  `;
  document.getElementById("bouton-aller-rejoindre").addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: "tontine/rejoindre" }));
  });
}

// =========================================================
// Rejoindre la tontine
// =========================================================
export async function ecranTontineRejoindre(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Rejoindre la tontine</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { moiId, cyclesOuverts, mesParticipations } = await recupererContexte();

  if (!cyclesOuverts.length) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Rejoindre la tontine</h2>
      <hr class="trait-or" />
      <p style="color:var(--texte-secondaire)">Aucun cycle de tontine n'est actuellement ouvert.</p>
    `;
    return;
  }

  const participationParCycle = Object.fromEntries(mesParticipations.map((p) => [p.cycle_id, p]));

  conteneur.innerHTML = `
    <h2 class="titre-section">Rejoindre la tontine</h2>
    <hr class="trait-or" />
    ${cyclesOuverts.map((c) => gabaritCycleARejoindre(c, participationParCycle[c.id])).join("")}
  `;

  conteneur.querySelectorAll("[data-rejoindre]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const cycleId = bouton.dataset.rejoindre;
      const { count } = await supabase
        .from("tontine_participants")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", cycleId);

      const { error } = await supabase.from("tontine_participants").insert({
        cycle_id: cycleId,
        membre_id: moiId,
        ordre_tour: (count || 0) + 1,
      });

      if (error) {
        alert("Impossible de rejoindre ce cycle, réessayez.");
        return;
      }

      notifier("Un nouveau membre a rejoint la tontine.");
      ecranTontineRejoindre(conteneur);
    });
  });
}

function gabaritCycleARejoindre(cycle, maParticipation) {
  return `
    <div class="carte">
      <p style="margin:0"><strong>${cycle.nom}</strong></p>
      <p style="color:var(--texte-secondaire); font-size:13px; margin:4px 0 12px">
        Versement mensuel : ${Number(cycle.montant_mensuel).toLocaleString("fr-FR")} FCFA
      </p>
      ${
        maParticipation
          ? `<p style="margin:0; font-size:13px; color:#4C9A6A">Vous participez déjà · Position ${maParticipation.ordre_tour}</p>`
          : `<button data-rejoindre="${cycle.id}" class="bouton bouton-or">Rejoindre ce cycle</button>`
      }
    </div>
  `;
}

// =========================================================
// Suivi de mon cycle
// =========================================================
export async function ecranTontineSuivi(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Suivi de mon cycle</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { moiId, cyclesOuverts, mesParticipations } = await recupererContexte();

  const idsCyclesRejoints = new Set(mesParticipations.map((p) => p.cycle_id));
  const mesCyclesOuverts = cyclesOuverts.filter((c) => idsCyclesRejoints.has(c.id));

  if (!mesCyclesOuverts.length) {
    rendreRedirectionRejoindre(conteneur, "Suivi de mon cycle");
    return;
  }

  conteneur.innerHTML = `<h2 class="titre-section">Suivi de mon cycle</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const blocs = await Promise.all(
    mesCyclesOuverts.map(async (cycle) => {
      const { data: participants } = await supabase
        .from("tontine_participants")
        .select("membre_id, ordre_tour, a_recu, recu_le, profils(nom, photo_url)")
        .eq("cycle_id", cycle.id)
        .order("ordre_tour");

      const maParticipation = mesParticipations.find((p) => p.cycle_id === cycle.id);
      const { data: mesVersements } = await supabase
        .from("tontine_versements")
        .select("id, montant, date_versement, statut")
        .eq("participant_id", maParticipation.id)
        .order("date_versement", { ascending: false });

      const lignes = (participants || [])
        .map((p) => {
          const cestMoi = p.membre_id === moiId;
          return `
          <div class="carte" style="display:flex; align-items:center; gap:12px; ${cestMoi ? "border-color:var(--or)" : ""}">
            <div style="width:32px; height:32px; min-width:32px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
                 display:flex; align-items:center; justify-content:center; font-size:13px; color:var(--or-texte)">
              ${p.profils?.photo_url ? `<img src="${p.profils.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover" />` : initiale(p.profils?.nom)}
            </div>
            <div style="flex:1">
              <p style="margin:0; font-size:14px; ${cestMoi ? "font-weight:600" : ""}">${p.profils?.nom || "—"} ${cestMoi ? "(vous)" : ""}</p>
              <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
                Position ${p.ordre_tour} ${p.a_recu ? "· A déjà reçu le " + formaterDate(p.recu_le) : "· En attente de réception"}
              </p>
            </div>
          </div>
        `;
        })
        .join("");

      const lignesVersements = (mesVersements || [])
        .map(
          (v) => `
        <div class="carte" style="display:flex; justify-content:space-between; align-items:center">
          <div>
            <p style="margin:0; font-weight:500">${Number(v.montant).toLocaleString("fr-FR")} FCFA</p>
            <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">${formaterDate(v.date_versement)}</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px">
            ${badgeStatut(v.statut)}
            ${v.statut === "en_attente" ? `<button data-supprimer-versement-tontine="${v.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>` : ""}
          </div>
        </div>
      `
        )
        .join("");

      return `
        <div class="carte" style="text-align:center; background:var(--fond-carte-claire)">
          <p style="margin:0; font-weight:500">${cycle.nom}</p>
          <p style="color:var(--texte-secondaire); font-size:13px; margin:4px 0 0">
            Versement mensuel : ${Number(cycle.montant_mensuel).toLocaleString("fr-FR")} FCFA
          </p>
        </div>
        ${lignes}
        ${mesVersements && mesVersements.length ? `<p style="font-size:12px; color:var(--texte-secondaire); margin:10px 0 4px">Mes versements</p>${lignesVersements}` : ""}
      `;
    })
  );

  conteneur.innerHTML = `
    <h2 class="titre-section">Suivi de mon cycle</h2>
    <hr class="trait-or" />
    ${blocs.join('<div style="height:8px"></div>')}
  `;

  conteneur.querySelectorAll("[data-supprimer-versement-tontine]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm("Supprimer ce versement en attente ?")) return;
      await supabase.from("tontine_versements").delete().eq("id", bouton.dataset.supprimerVersementTontine);
      ecranTontineSuivi(conteneur);
    });
  });
}

// =========================================================
// Faire mon versement (tontine)
// =========================================================
export async function ecranTontineVerser(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Faire mon versement</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { cyclesOuverts, mesParticipations } = await recupererContexte();

  const cyclesAvecParticipation = mesParticipations
    .map((p) => ({ participation: p, cycle: cyclesOuverts.find((c) => c.id === p.cycle_id) }))
    .filter((x) => x.cycle);

  if (!cyclesAvecParticipation.length) {
    rendreRedirectionRejoindre(conteneur, "Faire mon versement");
    return;
  }

  conteneur.innerHTML = `
    <h2 class="titre-section">Faire mon versement</h2>
    <hr class="trait-or" />
    <form id="formulaire-versement-tontine" class="carte" style="display:flex; flex-direction:column; gap:16px">
      ${
        cyclesAvecParticipation.length > 1
          ? `<label class="champ">
              <span>Cycle</span>
              <select name="participant_id" id="select-cycle-versement" required style="background:var(--fond); border:1px solid var(--bordure);
                      border-radius:var(--rayon-petit); padding:11px 12px; color:var(--texte); font-family:inherit; font-size:15px">
                ${cyclesAvecParticipation
                  .map((x) => `<option value="${x.participation.id}" data-montant="${x.cycle.montant_mensuel}">${x.cycle.nom}</option>`)
                  .join("")}
              </select>
            </label>`
          : `<input type="hidden" name="participant_id" value="${cyclesAvecParticipation[0].participation.id}" />
             <p style="color:var(--texte-secondaire); margin:-8px 0 0">Cycle : <strong style="color:var(--texte)">${cyclesAvecParticipation[0].cycle.nom}</strong></p>`
      }
      <label class="champ">
        <span>Montant (FCFA)</span>
        <input type="number" name="montant" min="1" step="1" required id="champ-montant-tontine" value="${cyclesAvecParticipation[0].cycle.montant_mensuel}" />
      </label>
      <label class="champ">
        <span>Date du versement</span>
        <input type="date" name="date_versement" required value="${new Date().toISOString().slice(0, 10)}" />
      </label>
      <p id="erreur-versement-tontine" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
      <p id="succes-versement-tontine" style="color:#4C9A6A; font-size:13px; margin:0" hidden>Versement déclaré, en attente de validation par un admin.</p>
      <button type="submit" class="bouton bouton-or">Déclarer le versement</button>
    </form>
  `;

  const selectCycle = document.getElementById("select-cycle-versement");
  if (selectCycle) {
    selectCycle.addEventListener("change", () => {
      document.getElementById("champ-montant-tontine").value = selectCycle.selectedOptions[0].dataset.montant;
    });
  }

  document.getElementById("formulaire-versement-tontine").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const participantId = donnees.get("participant_id");
    const cycleId = cyclesAvecParticipation.find((x) => x.participation.id === participantId)?.cycle.id;
    const erreur = document.getElementById("erreur-versement-tontine");
    const succes = document.getElementById("succes-versement-tontine");
    erreur.hidden = true;
    succes.hidden = true;

    const { error } = await supabase.from("tontine_versements").insert({
      cycle_id: cycleId,
      participant_id: participantId,
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
  });
}
