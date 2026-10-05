// =========================================================
// CEAI — Écrans "Tontine" (côté membre)
// Chaque cycle ouvert s'affiche sous forme de carte à thème
// (choisi par l'admin). Plusieurs cycles peuvent être ouverts en
// même temps : le membre touche celui qu'il veut rejoindre.
// Les positions ne sont affichées qu'après le tirage au sort.
// Les membres qui rejoignent après le tirage sont placés à la fin.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";
import {
  carteOuverture,
  activerCartesOuverture,
  echapper,
  formaterMontant,
} from "./composants-tableau.js";

// Cycle à présélectionner quand on touche une carte déjà rejointe
let cyclePreselectionne = null;

function naviguer(route) {
  window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: route }));
}

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

function texteTirage(cycle) {
  return cycle.tirage_effectue_le
    ? `Tirage au sort effectué le ${formaterDate(cycle.tirage_effectue_le)}`
    : "Tirage au sort à venir";
}

async function recupererContexte() {
  const moiId = await idProfilCourant();

  const [{ data: cyclesOuverts }, { data: mesParticipations }] = await Promise.all([
    supabase
      .from("tontine_cycles")
      .select("id, nom, montant_mensuel, theme, tirage_effectue_le")
      .eq("statut", "ouvert")
      .order("demarre_le", { ascending: false }),
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
  document.getElementById("bouton-aller-rejoindre").addEventListener("click", () => naviguer("tontine/rejoindre"));
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

  const cartes = cyclesOuverts
    .map((c) => {
      const participe = Boolean(participationParCycle[c.id]);
      return carteOuverture({
        nom: c.nom,
        theme: c.theme,
        badge: participe ? "Vous participez" : "",
        details: [
          `Versement mensuel : ${formaterMontant(c.montant_mensuel)}`,
          texteTirage(c),
          participe ? "Toucher pour suivre le cycle" : "Toucher pour rejoindre",
        ],
        attributs: `data-cycle="${c.id}" role="button" tabindex="0"`,
        classes: "ouverture-cliquable",
      });
    })
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Rejoindre la tontine</h2>
    <hr class="trait-or" />
    <p class="intro-ouvertures">Plusieurs cycles peuvent être ouverts en même temps. Touchez celui que vous voulez rejoindre.</p>
    <div class="grille-ouvertures">${cartes}</div>
  `;

  activerCartesOuverture(conteneur, "data-cycle", async (cycleId) => {
    const cycle = cyclesOuverts.find((c) => c.id === cycleId);

    if (participationParCycle[cycleId]) {
      naviguer("tontine/suivi");
      return;
    }

    const avertissement = cycle.tirage_effectue_le
      ? `\n\nLe tirage au sort a déjà eu lieu : vous serez placé à la fin de l'ordre de passage.`
      : "";
    if (!window.confirm(`Confirmer votre participation au cycle "${cycle.nom}" ?${avertissement}`)) return;

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

      const tirageFait = Boolean(cycle.tirage_effectue_le);

      const lignes = (participants || [])
        .map((p) => {
          const cestMoi = p.membre_id === moiId;
          const detail = tirageFait
            ? `Position ${p.ordre_tour} ${p.a_recu ? "· A déjà reçu le " + formaterDate(p.recu_le) : "· En attente de réception"}`
            : "En attente du tirage au sort";
          return `
          <div class="carte" style="display:flex; align-items:center; gap:12px; ${cestMoi ? "border-color:var(--or)" : ""}">
            <div style="width:32px; height:32px; min-width:32px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
                 display:flex; align-items:center; justify-content:center; font-size:13px; color:var(--or-texte)">
              ${p.profils?.photo_url ? `<img src="${echapper(p.profils.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover" />` : echapper(initiale(p.profils?.nom))}
            </div>
            <div style="flex:1">
              <p style="margin:0; font-size:14px; ${cestMoi ? "font-weight:600" : ""}">${echapper(p.profils?.nom || "—")} ${cestMoi ? "(vous)" : ""}</p>
              <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">${detail}</p>
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
            <p style="margin:0; font-weight:500">${formaterMontant(v.montant)}</p>
            <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">${formaterDate(v.date_versement)}</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px">
            ${badgeStatut(v.statut)}
            ${v.statut !== "valide" ? `<button data-supprimer-versement-tontine="${v.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>` : ""}
          </div>
        </div>
      `
        )
        .join("");

      return `
        ${carteOuverture({
          nom: cycle.nom,
          theme: cycle.theme,
          badge: tirageFait ? "Tirage effectué" : "Tirage à venir",
          details: [`Versement mensuel : ${formaterMontant(cycle.montant_mensuel)}`, texteTirage(cycle)],
        })}
        <div style="height:10px"></div>
        ${lignes}
        ${mesVersements && mesVersements.length ? `<p style="font-size:12px; color:var(--texte-secondaire); margin:10px 0 4px">Mes versements</p>${lignesVersements}` : ""}
      `;
    })
  );

  conteneur.innerHTML = `
    <h2 class="titre-section">Suivi de mon cycle</h2>
    <hr class="trait-or" />
    <div style="height:14px"></div>
    ${blocs.join('<div style="height:22px"></div>')}
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

  const initial =
    cyclesAvecParticipation.find((x) => x.cycle.id === cyclePreselectionne) || cyclesAvecParticipation[0];
  cyclePreselectionne = null;

  const cartes = cyclesAvecParticipation
    .map((x) =>
      carteOuverture({
        nom: x.cycle.nom,
        theme: x.cycle.theme,
        details: [`Versement mensuel : ${formaterMontant(x.cycle.montant_mensuel)}`],
        attributs: `data-choisir-cycle="${x.participation.id}" role="button" tabindex="0"`,
        classes: `ouverture-cliquable ${x.participation.id === initial.participation.id ? "selectionnee" : ""}`,
      })
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Faire mon versement</h2>
    <hr class="trait-or" />
    <p class="intro-ouvertures">${cyclesAvecParticipation.length > 1 ? "Choisissez le cycle concerné par votre versement." : "Cycle concerné par votre versement :"}</p>
    <div class="grille-ouvertures">${cartes}</div>
    <form id="formulaire-versement-tontine" class="carte" style="display:flex; flex-direction:column; gap:16px">
      <input type="hidden" name="participant_id" id="champ-participant-tontine" value="${initial.participation.id}" />
      <label class="champ">
        <span>Montant (FCFA)</span>
        <input type="number" name="montant" min="1" step="1" required id="champ-montant-tontine" value="${initial.cycle.montant_mensuel}" />
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

  activerCartesOuverture(conteneur, "data-choisir-cycle", (participantId, carte) => {
    conteneur.querySelectorAll("[data-choisir-cycle]").forEach((c) => c.classList.remove("selectionnee"));
    carte.classList.add("selectionnee");
    document.getElementById("champ-participant-tontine").value = participantId;
    const choisi = cyclesAvecParticipation.find((x) => x.participation.id === participantId);
    document.getElementById("champ-montant-tontine").value = choisi?.cycle.montant_mensuel ?? "";
  });

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

    const montantDeclare = donnees.get("montant");
    evenement.target.reset();
    document.getElementById("champ-participant-tontine").value = participantId;
    succes.hidden = false;
    notifier(`Un versement de tontine a été déclaré (${montantDeclare} FCFA).`);
  });
}
