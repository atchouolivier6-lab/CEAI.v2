// =========================================================
// CEAI — Écran admin "Gestion de la tontine"
// Plusieurs cycles peuvent être ouverts en même temps.
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
    supabase.from("tontine_cycles").select("id, nom, montant_mensuel, statut, demarre_le, cloture_le").order("demarre_le", { ascending: false }),
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
    listeCycles.innerHTML = `<p style="color:var(--texte-secondaire)">Aucun cycle pour le moment.</p>`;
    return;
  }

  listeCycles.innerHTML = cycles
    .map((c) => {
      const participantsCycle = (participants || []).filter((p) => p.cycle_id === c.id);
      const versementsCycle = (versements || []).filter((v) => v.cycle_id === c.id);
      const enAttente = versementsCycle.filter((v) => v.statut === "en_attente");
      const estOuvert = c.statut === "ouvert";

      return `
      <div class="carte">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
          <div>
            <p style="margin:0; font-weight:500">${c.nom}</p>
            <p style="margin:4px 0 0; font-size:12px; color:var(--texte-secondaire)">
              Démarré le ${formaterDate(c.demarre_le)}${c.cloture_le ? " · Clôturé le " + formaterDate(c.cloture_le) : ""} · ${Number(c.montant_mensuel).toLocaleString("fr-FR")} FCFA/mois · ${participantsCycle.length} participant(s)
            </p>
          </div>
          <span style="font-size:11px; color:${estOuvert ? "#4C9A6A" : "var(--texte-secondaire)"}; border:1px solid currentColor; padding:2px 8px; border-radius:999px; white-space:nowrap">
            ${estOuvert ? "Ouvert" : "Clôturé"}
          </span>
        </div>

        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
          <button data-basculer-participants="${c.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
            Participants (${participantsCycle.length})
          </button>
          ${
            estOuvert
              ? `<button data-basculer-versements="${c.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
                   Versements en attente (${enAttente.length})
                 </button>
                 <button data-cloturer="${c.id}" data-nom="${c.nom}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 12px; font-size:13px">Clôturer</button>`
              : ""
          }
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
          ${estOuvert ? gabaritAjoutParticipant(c.id, participantsCycle, membres || []) : ""}
        </div>

        <div data-liste-versements="${c.id}" hidden style="margin-top:12px; display:flex; flex-direction:column; gap:8px">
          ${
            enAttente.length
              ? enAttente.map((v) => gabaritVersementEnAttente(v)).join("")
              : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun versement en attente.</p>`
          }
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

  // --- Clôturer / Supprimer un cycle ---------------------------------------
  listeCycles.querySelectorAll("[data-cloturer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Clôturer "${bouton.dataset.nom}" ? Cette action est définitive.`)) return;
      await supabase
        .from("tontine_cycles")
        .update({ statut: "cloture", cloture_par: moiId, cloture_le: new Date().toISOString() })
        .eq("id", bouton.dataset.cloturer);
      notifier(`Le cycle de tontine "${bouton.dataset.nom}" a été clôturé.`);
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
