// =========================================================
// CEAI — Écran admin "Gestion de la tontine"
// Plusieurs cycles peuvent être ouverts en même temps.
// Un cycle clôturé disparaît de cet écran et n'est plus
// visible que dans les Archives de tontine. Avant de clôturer,
// l'admin renseigne le bénéficiaire du tour et le montant reçu,
// visibles ensuite par tous les membres dans les Archives.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export async function ecranAdminTontine(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion de la tontine</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;
  await rafraichir(conteneur);
}

async function rafraichir(conteneur) {
  const moiId = await idProfilCourant();

  const [{ data: cycles }, { data: participants }, { data: versements }, { data: membres }] = await Promise.all([
    supabase
      .from("tontine_cycles")
      .select("id, nom, montant_mensuel, statut, demarre_le, cloture_le")
      .eq("statut", "ouvert")
      .order("demarre_le", { ascending: false }),
    supabase.from("tontine_participants").select("id, cycle_id, membre_id, ordre_tour, a_recu, recu_le, profils(nom)").order("ordre_tour"),
    supabase.from("tontine_versements").select("id, cycle_id, montant, date_versement, statut, tontine_participants(profils(nom))"),
    supabase.from("profils").select("id, nom").eq("actif", true).order("nom"),
  ]);

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion de la tontine</h2>
    <hr class="trait-or" />

    <button id="bouton-nouveau-cycle" class="bouton bouton-or" style="margin-bottom:16px">+ Ouvrir un nouveau cycle</button>
    <div id="formulaire-cycle-conteneur"></div>

    <div id="liste-cycles"></div>
  `;

  document.getElementById("bouton-nouveau-cycle").addEventListener("click", () => {
    document.getElementById("formulaire-cycle-conteneur").innerHTML = `
      <form id="formulaire-ouverture-cycle" class="carte" style="display:flex; flex-direction:column; gap:12px">
        <label class="champ">
          <span>Nom du cycle (ex: Cycle 2026)</span>
          <input type="text" name="nom" required />
        </label>
        <label class="champ">
          <span>Montant mensuel (FCFA)</span>
          <input type="number" name="montant_mensuel" min="1" required />
        </label>
        <p id="erreur-ouverture-tontine" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
        <button type="submit" class="bouton bouton-or">Ouvrir le cycle</button>
      </form>
    `;
    document.getElementById("formulaire-ouverture-cycle").addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const donnees = new FormData(evenement.target);
      const nom = donnees.get("nom").trim();
      const erreur = document.getElementById("erreur-ouverture-tontine");

      const { error } = await supabase.from("tontine_cycles").insert({
        nom,
        montant_mensuel: Number(donnees.get("montant_mensuel")),
        cree_par: moiId,
        demarre_le: new Date().toISOString().slice(0, 10),
      });
      if (error) {
        erreur.textContent = "Erreur : " + error.message;
        erreur.hidden = false;
        return;
      }
      notifier(`Nouveau cycle de tontine ouvert : ${nom}`);
      rafraichir(conteneur);
    });
  });

  const listeCycles = document.getElementById("liste-cycles");
  if (!cycles || !cycles.length) {
    listeCycles.innerHTML = `<p style="color:var(--texte-secondaire)">Aucun cycle ouvert pour le moment. Les cycles clôturés se trouvent dans les Archives.</p>`;
    return;
  }

  listeCycles.innerHTML = cycles
    .map((c) => {
      const participantsCycle = (participants || []).filter((p) => p.cycle_id === c.id);
      const versementsCycle = (versements || []).filter((v) => v.cycle_id === c.id);
      const enAttente = versementsCycle.filter((v) => v.statut === "en_attente");

      return `
      <div class="carte">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
          <div>
            <p style="margin:0; font-weight:500">${c.nom}</p>
            <p style="margin:4px 0 0; font-size:12px; color:var(--texte-secondaire)">
              Démarré le ${formaterDate(c.demarre_le)} · ${Number(c.montant_mensuel).toLocaleString("fr-FR")} FCFA/mois · ${participantsCycle.length} participant(s)
            </p>
          </div>
          <span style="font-size:11px; color:#4C9A6A; border:1px solid currentColor; padding:2px 8px; border-radius:999px; white-space:nowrap">
            Ouvert
          </span>
        </div>

        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
          <button data-basculer-participants="${c.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
            Participants (${participantsCycle.length})
          </button>
          <button data-basculer-versements="${c.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
            Versements en attente (${enAttente.length})
          </button>
          <button data-ouvrir-bilan="${c.id}" data-nom="${c.nom}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 12px; font-size:13px">Clôturer</button>
          <button data-supprimer="${c.id}" data-nom="${c.nom}" class="bouton" style="background:var(--fond-carte-claire); color:var(--danger); padding:6px 12px; font-size:13px">
            Supprimer
          </button>
        </div>

        <div data-liste-participants="${c.id}" hidden style="margin-top:12px; display:flex; flex-direction:column; gap:6px">
          ${
            participantsCycle.length
              ? participantsCycle.map((p) => gabaritParticipant(p)).join("")
              : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun participant.</p>`
          }
          ${gabaritAjoutParticipant(c.id, participantsCycle, membres || [])}
        </div>

        <div data-liste-versements="${c.id}" hidden style="margin-top:12px; display:flex; flex-direction:column; gap:8px">
          ${
            enAttente.length
              ? enAttente.map((v) => gabaritVersementEnAttente(v)).join("")
              : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun versement en attente.</p>`
          }
        </div>

        <div data-formulaire-bilan="${c.id}" hidden style="margin-top:16px; padding-top:16px; border-top:1px solid var(--bordure)">
          ${gabaritFormulaireBilan(c, participantsCycle)}
        </div>
      </div>
    `;
    })
    .join("");

  // --- Bascules d'affichage --------------------------------------------
  listeCycles.querySelectorAll("[data-basculer-participants]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeCycles.querySelector(`[data-liste-participants="${bouton.dataset.basculerParticipants}"]`);
      zone.hidden = !zone.hidden;
    });
  });
  listeCycles.querySelectorAll("[data-basculer-versements]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeCycles.querySelector(`[data-liste-versements="${bouton.dataset.basculerVersements}"]`);
      zone.hidden = !zone.hidden;
    });
  });

  // --- Ajouter un participant ---------------------------------------------
  listeCycles.querySelectorAll("[data-bouton-ajout-participant]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const cycleId = bouton.dataset.boutonAjoutParticipant;
      const select = listeCycles.querySelector(`.select-ajout-participant[data-cycle-id="${cycleId}"]`);
      const membreId = select.value;
      if (!membreId) return;

      const participantsDuCycle = (participants || []).filter((p) => p.cycle_id === cycleId);
      const prochainOrdre = participantsDuCycle.length
        ? Math.max(...participantsDuCycle.map((p) => p.ordre_tour)) + 1
        : 1;

      const { error } = await supabase.from("tontine_participants").insert({
        cycle_id: cycleId,
        membre_id: membreId,
        ordre_tour: prochainOrdre,
      });

      if (error) {
        alert("Erreur : " + error.message);
        return;
      }
      rafraichir(conteneur);
    });
  });

  // --- Retirer un participant --------------------------------------------
  listeCycles.querySelectorAll("[data-retirer-participant]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Retirer ${bouton.dataset.nom} de ce cycle ?`)) return;
      const { error } = await supabase.from("tontine_participants").delete().eq("id", bouton.dataset.retirerParticipant);
      if (error) {
        alert("Impossible de retirer ce participant : " + error.message + " (il a probablement déjà des versements enregistrés)");
        return;
      }
      rafraichir(conteneur);
    });
  });

  // --- Marquer reçu --------------------------------------------------------
  listeCycles.querySelectorAll("[data-basculer-recu]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const aRecuActuellement = bouton.dataset.aRecu === "true";
      await supabase
        .from("tontine_participants")
        .update({ a_recu: !aRecuActuellement, recu_le: !aRecuActuellement ? new Date().toISOString().slice(0, 10) : null })
        .eq("id", bouton.dataset.basculerRecu);
      rafraichir(conteneur);
    });
  });

  // --- Ouvrir / annuler le bilan de clôture -------------------------------
  listeCycles.querySelectorAll("[data-ouvrir-bilan]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeCycles.querySelector(`[data-formulaire-bilan="${bouton.dataset.ouvrirBilan}"]`);
      zone.hidden = !zone.hidden;
      if (!zone.hidden) zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  listeCycles.querySelectorAll("[data-annuler-bilan]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      listeCycles.querySelector(`[data-formulaire-bilan="${bouton.dataset.annulerBilan}"]`).hidden = true;
    });
  });

  listeCycles.querySelectorAll("[data-formulaire-bilan-tontine]").forEach((formulaire) => {
    formulaire.addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const cycleId = formulaire.dataset.formulaireBilanTontine;
      const nomCycle = cycles.find((c) => c.id === cycleId)?.nom || "";
      const donnees = new FormData(evenement.target);
      const erreur = formulaire.querySelector(".erreur-bilan");
      erreur.hidden = true;

      const beneficiaireParticipantId = donnees.get("beneficiaire_participant_id");
      if (!beneficiaireParticipantId) {
        erreur.textContent = "Veuillez indiquer qui a reçu le tour.";
        erreur.hidden = false;
        return;
      }

      if (!window.confirm(`Confirmer la clôture de "${nomCycle}" ? Cette action est définitive.`)) return;

      const { error: erreurBilan } = await supabase.from("tontine_bilans").insert({
        cycle_id: cycleId,
        beneficiaire_participant_id: beneficiaireParticipantId,
        montant_recu: Number(donnees.get("montant_recu")) || null,
        notes: donnees.get("notes")?.trim() || null,
        rempli_par: moiId,
      });

      if (erreurBilan) {
        erreur.textContent = "Erreur (bilan) : " + erreurBilan.message;
        erreur.hidden = false;
        return;
      }

      const { data: cycleCloture, error: erreurCloture } = await supabase
        .from("tontine_cycles")
        .update({ statut: "cloture", cloture_par: moiId, cloture_le: new Date().toISOString() })
        .eq("id", cycleId)
        .select();

      if (erreurCloture || !cycleCloture || !cycleCloture.length) {
        erreur.textContent = "La clôture a échoué : " + (erreurCloture?.message || "aucune ligne modifiée (droits insuffisants ?)");
        erreur.hidden = false;
        return;
      }

      notifier(`Le cycle de tontine "${nomCycle}" a été clôturé.`);
      rafraichir(conteneur);
    });
  });

  listeCycles.querySelectorAll("[data-supprimer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer définitivement "${bouton.dataset.nom}", ses participants et ses versements ? Cette action est irréversible.`)) return;
      const { error } = await supabase.from("tontine_cycles").delete().eq("id", bouton.dataset.supprimer);
      if (error) {
        alert("Erreur : " + error.message);
        return;
      }
      rafraichir(conteneur);
    });
  });

  // --- Validation des versements -------------------------------------------
  listeCycles.querySelectorAll("[data-valider]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("tontine_versements")
        .update({ statut: "valide", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.valider);
      rafraichir(conteneur);
    });
  });
  listeCycles.querySelectorAll("[data-rejeter]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("tontine_versements")
        .update({ statut: "rejete", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.rejeter);
      rafraichir(conteneur);
    });
  });
}

function gabaritFormulaireBilan(cycle, participantsCycle) {
  const montantSuggere = Number(cycle.montant_mensuel) * participantsCycle.length;

  return `
    <form data-formulaire-bilan-tontine="${cycle.id}" style="display:flex; flex-direction:column; gap:14px">
      <p style="margin:0; font-weight:500">Bilan de clôture — ${cycle.nom}</p>
      <p style="margin:0; font-size:12px; color:var(--texte-secondaire)">
        Ce bilan sera visible par tous les membres dans les Archives.
      </p>

      <label class="champ">
        <span>Qui a reçu le tour ?</span>
        <select name="beneficiaire_participant_id" required style="background:var(--fond); border:1px solid var(--bordure);
                border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-family:inherit; font-size:13px">
          <option value="">— Sélectionner —</option>
          ${participantsCycle
            .map((p) => `<option value="${p.id}">${p.ordre_tour}. ${p.profils?.nom || "—"}</option>`)
            .join("")}
        </select>
      </label>

      <label class="champ">
        <span>Montant reçu (FCFA)</span>
        <input type="number" name="montant_recu" min="0" step="1" value="${montantSuggere}"
               style="width:100%; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
      </label>

      <label class="champ">
        <span>Notes (comment s'est passé le tour, incidents éventuels...)</span>
        <textarea name="notes" rows="3"
                  style="width:100%; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-family:inherit; font-size:13px; resize:vertical"></textarea>
      </label>

      <p class="erreur-bilan" style="color:var(--danger); font-size:13px; margin:0" hidden></p>

      <div style="display:flex; gap:8px">
        <button type="submit" class="bouton" style="background:var(--danger); color:#fff; flex:1">Confirmer la clôture</button>
        <button type="button" data-annuler-bilan="${cycle.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte)">Annuler</button>
      </div>
    </form>
  `;
}

function gabaritAjoutParticipant(cycleId, participantsCycle, membres) {
  const idsDejaDedans = new Set(participantsCycle.map((p) => p.membre_id));
  const disponibles = membres.filter((m) => !idsDejaDedans.has(m.id));

  if (!disponibles.length) return "";

  return `
    <div style="display:flex; gap:6px; margin-top:8px">
      <select class="select-ajout-participant" data-cycle-id="${cycleId}"
              style="flex:1; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit);
              padding:8px; color:var(--texte); font-size:13px">
        <option value="">Ajouter un membre…</option>
        ${disponibles.map((m) => `<option value="${m.id}">${m.nom}</option>`).join("")}
      </select>
      <button data-bouton-ajout-participant="${cycleId}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:8px 12px; font-size:13px">
        Ajouter
      </button>
    </div>
  `;
}

function gabaritParticipant(p) {
  return `
    <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-top:1px solid var(--bordure)">
      <p style="flex:1; margin:0; font-size:13px">${p.ordre_tour}. ${p.profils?.nom || "—"} ${p.a_recu ? "· A reçu" : ""}</p>
      <button data-basculer-recu="${p.id}" data-a-recu="${p.a_recu}" class="bouton"
              style="background:${p.a_recu ? "#4C9A6A" : "var(--fond-carte-claire)"}; color:${p.a_recu ? "#fff" : "var(--texte)"};
              padding:4px 8px; font-size:11px; white-space:nowrap">
        ${p.a_recu ? "Reçu ✓" : "Marquer reçu"}
      </button>
      <button data-retirer-participant="${p.id}" data-nom="${p.profils?.nom || ""}" class="bouton-icone" aria-label="Retirer" style="color:var(--danger)">✕</button>
    </div>
  `;
}

function gabaritVersementEnAttente(v) {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--bordure)">
      <div>
        <p style="margin:0; font-weight:500; font-size:14px">${v.tontine_participants?.profils?.nom || "—"}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${Number(v.montant).toLocaleString("fr-FR")} FCFA · ${new Date(v.date_versement).toLocaleDateString("fr-FR")}
        </p>
      </div>
      <div style="display:flex; gap:6px">
        <button data-valider="${v.id}" class="bouton" style="background:#4C9A6A; color:#fff; padding:6px 10px; font-size:12px">Valider</button>
        <button data-rejeter="${v.id}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 10px; font-size:12px">Rejeter</button>
      </div>
    </div>
  `;
}
