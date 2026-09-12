// =========================================================
// CEAI — Écrans "Tontine" (côté membre)
// =========================================================
import { supabase } from "../supabase-client.js";

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
  const { data: session } = await supabase.auth.getUser();
  const moiId = session?.user?.id;

  const { data: cycleOuvert } = await supabase
    .from("tontine_cycles")
    .select("id, nom, montant_mensuel")
    .eq("statut", "ouvert")
    .maybeSingle();

  let participant = null;
  if (cycleOuvert) {
    const { data } = await supabase
      .from("tontine_participants")
      .select("id, ordre_tour, a_recu")
      .eq("cycle_id", cycleOuvert.id)
      .eq("membre_id", moiId)
      .maybeSingle();
    participant = data;
  }

  return { moiId, cycleOuvert, participant };
}

function rendreRedirectionRejoindre(conteneur, titre) {
  conteneur.innerHTML = `
    <h2 class="titre-section">${titre}</h2>
    <hr class="trait-or" />
    <div class="carte">
      <p style="margin:0">Vous devez d'abord rejoindre le cycle de tontine en cours.</p>
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

  const { moiId, cycleOuvert, participant } = await recupererContexte();

  if (!cycleOuvert) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Rejoindre la tontine</h2>
      <hr class="trait-or" />
      <p style="color:var(--texte-secondaire)">Aucun cycle de tontine n'est actuellement ouvert.</p>
    `;
    return;
  }

  if (participant) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Rejoindre la tontine</h2>
      <hr class="trait-or" />
      <div class="carte">
        <p style="margin:0">Vous participez déjà au cycle « ${cycleOuvert.nom} ».</p>
        <p style="color:var(--texte-secondaire); font-size:13px; margin:8px 0 0">Votre position actuelle : ${participant.ordre_tour}</p>
      </div>
    `;
    return;
  }

  conteneur.innerHTML = `
    <h2 class="titre-section">Rejoindre la tontine</h2>
    <hr class="trait-or" />
    <div class="carte">
      <p style="margin:0">Cycle en cours : <strong>${cycleOuvert.nom}</strong></p>
      <p style="color:var(--texte-secondaire); font-size:13px; margin:4px 0 12px">
        Versement mensuel : ${Number(cycleOuvert.montant_mensuel).toLocaleString("fr-FR")} FCFA
      </p>
      <button id="bouton-rejoindre" class="bouton bouton-or bouton-pleine-largeur">Rejoindre ce cycle</button>
      <p id="erreur-rejoindre" style="color:var(--danger); font-size:13px; margin-top:10px" hidden></p>
    </div>
  `;

  document.getElementById("bouton-rejoindre").addEventListener("click", async () => {
    const { count } = await supabase
      .from("tontine_participants")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", cycleOuvert.id);

    const { error } = await supabase.from("tontine_participants").insert({
      cycle_id: cycleOuvert.id,
      membre_id: moiId,
      ordre_tour: (count || 0) + 1,
    });

    if (error) {
      const erreur = document.getElementById("erreur-rejoindre");
      erreur.textContent = "Impossible de rejoindre le cycle, réessayez.";
      erreur.hidden = false;
      return;
    }

    ecranTontineRejoindre(conteneur);
  });
}

// =========================================================
// Suivi de mon cycle
// =========================================================
export async function ecranTontineSuivi(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Suivi de mon cycle</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { moiId, cycleOuvert, participant } = await recupererContexte();

  if (!cycleOuvert) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Suivi de mon cycle</h2>
      <hr class="trait-or" />
      <p style="color:var(--texte-secondaire)">Aucun cycle de tontine n'est actuellement ouvert.</p>
    `;
    return;
  }

  if (!participant) {
    rendreRedirectionRejoindre(conteneur, "Suivi de mon cycle");
    return;
  }

  const { data: participants } = await supabase
    .from("tontine_participants")
    .select("membre_id, ordre_tour, a_recu, recu_le, profils(nom, photo_url)")
    .eq("cycle_id", cycleOuvert.id)
    .order("ordre_tour");

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

  conteneur.innerHTML = `
    <h2 class="titre-section">Suivi de mon cycle</h2>
    <hr class="trait-or" />
    <div class="carte" style="text-align:center">
      <p style="margin:0; font-weight:500">${cycleOuvert.nom}</p>
      <p style="color:var(--texte-secondaire); font-size:13px; margin:4px 0 0">
        Versement mensuel : ${Number(cycleOuvert.montant_mensuel).toLocaleString("fr-FR")} FCFA
      </p>
    </div>
    ${lignes}
  `;
}

// =========================================================
// Faire mon versement (tontine)
// =========================================================
export async function ecranTontineVerser(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Faire mon versement</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { cycleOuvert, participant } = await recupererContexte();

  if (!cycleOuvert) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Faire mon versement</h2>
      <hr class="trait-or" />
      <p style="color:var(--texte-secondaire)">Aucun cycle de tontine n'est actuellement ouvert.</p>
    `;
    return;
  }

  if (!participant) {
    rendreRedirectionRejoindre(conteneur, "Faire mon versement");
    return;
  }

  conteneur.innerHTML = `
    <h2 class="titre-section">Faire mon versement</h2>
    <hr class="trait-or" />
    <p style="color:var(--texte-secondaire); margin-top:-8px">Cycle en cours : <strong style="color:var(--texte)">${cycleOuvert.nom}</strong></p>
    <form id="formulaire-versement-tontine" class="carte" style="display:flex; flex-direction:column; gap:16px">
      <label class="champ">
        <span>Montant (FCFA)</span>
        <input type="number" name="montant" min="1" step="1" required value="${cycleOuvert.montant_mensuel}" />
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

  document.getElementById("formulaire-versement-tontine").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const erreur = document.getElementById("erreur-versement-tontine");
    const succes = document.getElementById("succes-versement-tontine");
    erreur.hidden = true;
    succes.hidden = true;

    const { error } = await supabase.from("tontine_versements").insert({
      cycle_id: cycleOuvert.id,
      participant_id: participant.id,
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
