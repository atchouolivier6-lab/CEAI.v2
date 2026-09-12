// =========================================================
// CEAI — Écran admin "Gestion de la tontine"
// =========================================================
import { supabase } from "../supabase-client.js";

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export async function ecranAdminTontine(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion de la tontine</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { data: session } = await supabase.auth.getUser();
  const moiId = session?.user?.id;

  const { data: cycleOuvert } = await supabase
    .from("tontine_cycles")
    .select("id, nom, montant_mensuel, demarre_le")
    .eq("statut", "ouvert")
    .maybeSingle();

  if (!cycleOuvert) {
    rendreFormulaireOuverture(conteneur, moiId);
    return;
  }

  const [{ data: participants }, { data: versements }] = await Promise.all([
    supabase
      .from("tontine_participants")
      .select("id, membre_id, ordre_tour, a_recu, recu_le, profils(nom)")
      .eq("cycle_id", cycleOuvert.id)
      .order("ordre_tour"),
    supabase
      .from("tontine_versements")
      .select("id, montant, date_versement, statut, tontine_participants(profils(nom))")
      .eq("cycle_id", cycleOuvert.id)
      .order("date_versement", { ascending: false }),
  ]);

  const enAttente = (versements || []).filter((v) => v.statut === "en_attente");
  const traites = (versements || []).filter((v) => v.statut !== "en_attente");

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion de la tontine</h2>
    <hr class="trait-or" />

    <div class="carte">
      <p style="margin:0; font-weight:500">${cycleOuvert.nom}</p>
      <p style="margin:4px 0 12px; font-size:13px; color:var(--texte-secondaire)">
        Démarré le ${formaterDate(cycleOuvert.demarre_le)} · ${Number(cycleOuvert.montant_mensuel).toLocaleString("fr-FR")} FCFA / mois
      </p>
      <button id="bouton-cloturer-cycle" class="bouton" style="background:var(--danger); color:#fff">Clôturer ce cycle</button>
    </div>

    <p style="font-weight:500; margin:20px 0 8px">Ordre de passage (${(participants || []).length} participants)</p>
    <button id="bouton-tirage" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); margin-bottom:10px">
      🎲 Tirage au sort de l'ordre
    </button>
    <div id="liste-participants"></div>
    <button id="bouton-enregistrer-ordre" class="bouton bouton-or" style="margin-top:10px">Enregistrer l'ordre</button>

    <p style="font-weight:500; margin:24px 0 8px">Versements en attente (${enAttente.length})</p>
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

  rendreListeParticipants(participants || []);

  document.getElementById("bouton-cloturer-cycle").addEventListener("click", async () => {
    if (!window.confirm(`Clôturer "${cycleOuvert.nom}" ? Cette action est définitive.`)) return;
    await supabase
      .from("tontine_cycles")
      .update({ statut: "cloture", cloture_par: moiId, cloture_le: new Date().toISOString() })
      .eq("id", cycleOuvert.id);
    ecranAdminTontine(conteneur);
  });

  document.getElementById("bouton-tirage").addEventListener("click", () => {
    const ordresMelanges = (participants || [])
      .map((p) => p.ordre_tour)
      .sort(() => Math.random() - 0.5);
    document.querySelectorAll(".entree-ordre").forEach((input, i) => {
      input.value = ordresMelanges[i];
    });
  });

  document.getElementById("bouton-enregistrer-ordre").addEventListener("click", async () => {
    const entrees = [...document.querySelectorAll(".entree-ordre")];
    const boutonEnregistrer = document.getElementById("bouton-enregistrer-ordre");
    boutonEnregistrer.disabled = true;

    // Deux passes : d'abord des valeurs temporaires négatives (uniques),
    // puis les valeurs finales — évite un conflit avec la contrainte
    // d'unicité si deux participants échangent leur position.
    for (let i = 0; i < entrees.length; i++) {
      await supabase.from("tontine_participants").update({ ordre_tour: -(i + 1) }).eq("id", entrees[i].dataset.participantId);
    }
    for (const input of entrees) {
      await supabase.from("tontine_participants").update({ ordre_tour: Number(input.value) }).eq("id", input.dataset.participantId);
    }

    ecranAdminTontine(conteneur);
  });

  conteneur.querySelectorAll("[data-basculer-recu]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const aRecuActuellement = bouton.dataset.aRecu === "true";
      await supabase
        .from("tontine_participants")
        .update({ a_recu: !aRecuActuellement, recu_le: !aRecuActuellement ? new Date().toISOString().slice(0, 10) : null })
        .eq("id", bouton.dataset.basculerRecu);
      ecranAdminTontine(conteneur);
    });
  });

  conteneur.querySelectorAll("[data-valider]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("tontine_versements")
        .update({ statut: "valide", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.valider);
      ecranAdminTontine(conteneur);
    });
  });

  conteneur.querySelectorAll("[data-rejeter]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("tontine_versements")
        .update({ statut: "rejete", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.rejeter);
      ecranAdminTontine(conteneur);
    });
  });
}

function rendreListeParticipants(participants) {
  const conteneurListe = document.getElementById("liste-participants");
  conteneurListe.innerHTML = participants
    .map(
      (p) => `
    <div class="carte" style="display:flex; align-items:center; gap:10px">
      <input type="number" class="entree-ordre" data-participant-id="${p.id}" value="${p.ordre_tour}"
             style="width:52px; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit);
             padding:8px; color:var(--texte); text-align:center; font-size:14px" />
      <p style="flex:1; margin:0; font-size:14px">${p.profils?.nom || "—"}</p>
      <button data-basculer-recu="${p.id}" data-a-recu="${p.a_recu}"
              class="bouton" style="background:${p.a_recu ? "#4C9A6A" : "var(--fond-carte-claire)"}; color:${p.a_recu ? "#fff" : "var(--texte)"};
              padding:6px 10px; font-size:12px; white-space:nowrap">
        ${p.a_recu ? "A reçu ✓" : "Marquer reçu"}
      </button>
    </div>
  `
    )
    .join("");
}

function gabaritVersementEnAttente(v) {
  return `
    <div class="carte" style="display:flex; justify-content:space-between; align-items:center; gap:10px">
      <div>
        <p style="margin:0; font-weight:500">${v.tontine_participants?.profils?.nom || "—"}</p>
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
        <p style="margin:0; font-size:14px">${v.tontine_participants?.profils?.nom || "—"}</p>
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
    <h2 class="titre-section">Gestion de la tontine</h2>
    <hr class="trait-or" />
    <div class="carte">
      <p style="margin:0 0 12px; color:var(--texte-secondaire)">Aucun cycle de tontine n'est actuellement ouvert.</p>
      <form id="formulaire-ouverture-cycle" style="display:flex; flex-direction:column; gap:12px">
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
    </div>
  `;

  document.getElementById("formulaire-ouverture-cycle").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const erreur = document.getElementById("erreur-ouverture-tontine");

    const { error } = await supabase.from("tontine_cycles").insert({
      nom: donnees.get("nom").trim(),
      montant_mensuel: Number(donnees.get("montant_mensuel")),
      cree_par: moiId,
      demarre_le: new Date().toISOString().slice(0, 10),
    });

    if (error) {
      erreur.textContent = "Impossible d'ouvrir le cycle, réessayez.";
      erreur.hidden = false;
      return;
    }

    ecranAdminTontine(conteneur);
  });
    }
