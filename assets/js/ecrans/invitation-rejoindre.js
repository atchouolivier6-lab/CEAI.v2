// =========================================================
// CEAI — Écran d'arrivée d'une invitation
// Route : invitation/cotisation/<référence> ou invitation/tontine/<référence>
// La référence est le code court de la session ou du cycle
// (ex. janvier-2026-k7m2qx9p) ; l'ancien identifiant long marche aussi.
// Le membre (connecté) voit directement la session ou le cycle
// et peut y adhérer en un geste.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";
import { carteOuverture, formaterMontant, echapper } from "./composants-tableau.js";

function naviguer(route) {
  window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: route }));
}

const ENTETE = `<h2 class="titre-section">Invitation</h2><hr class="trait-or" />`;
const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le code est toujours les 8 derniers caractères ; le début du lien n'est que le nom, pour la lisibilité
function critere(reference) {
  return EST_UUID.test(reference) ? ["id", reference] : ["code_invitation", reference.slice(-8).toLowerCase()];
}

function rendreMessage(conteneur, texte) {
  conteneur.innerHTML = `
    ${ENTETE}
    <div class="carte">
      <p style="margin:0">${echapper(texte)}</p>
      <button id="bouton-accueil" class="bouton bouton-or" style="margin-top:12px">Retour à l'accueil</button>
    </div>
  `;
  document.getElementById("bouton-accueil").addEventListener("click", () => naviguer("accueil"));
}

// ---------------------------------------------------------
// Chargement : une "invitation" décrit tout ce qu'il faut afficher
// ---------------------------------------------------------
async function chargerCotisation(reference, moiId) {
  const [champ, valeur] = critere(reference);
  const { data: session } = await supabase
    .from("cotisation_sessions")
    .select("id, nom, montant_indicatif, theme, statut")
    .eq(champ, valeur)
    .maybeSingle();
  if (!session || session.statut !== "ouverte") return null;

  const { data: adhesion } = await supabase
    .from("cotisation_adhesions")
    .select("session_id")
    .eq("membre_id", moiId)
    .eq("session_id", session.id)
    .maybeSingle();

  return {
    nom: session.nom,
    theme: session.theme,
    details: [
      "Session de cotisation",
      session.montant_indicatif ? `Montant indicatif : ${formaterMontant(session.montant_indicatif)}` : "Montant libre",
    ],
    dejaMembre: Boolean(adhesion),
    texteInvitation: "Vous avez été invité à rejoindre cette session de cotisation.",
    texteDeja: "Vous avez déjà adhéré à cette session.",
    texteSucces: `Vous avez adhéré à la session "${session.nom}".`,
    libelleRejoindre: "Adhérer à cette session",
    confirmation: `Confirmer votre adhésion à la session "${session.nom}" ?`,
    libelleSuite: "Faire mon versement",
    routeSuite: "cotisation/verser",
    async rejoindre() {
      const { error } = await supabase.from("cotisation_adhesions").insert({ membre_id: moiId, session_id: session.id });
      if (!error) notifier(`Un nouveau membre a adhéré à la session "${session.nom}".`);
      return error;
    },
  };
}

async function chargerTontine(reference, moiId) {
  const [champ, valeur] = critere(reference);
  const { data: cycle } = await supabase
    .from("tontine_cycles")
    .select("id, nom, montant_mensuel, theme, statut, tirage_effectue_le")
    .eq(champ, valeur)
    .maybeSingle();
  if (!cycle || cycle.statut !== "ouvert") return null;

  const { data: participation } = await supabase
    .from("tontine_participants")
    .select("id")
    .eq("membre_id", moiId)
    .eq("cycle_id", cycle.id)
    .maybeSingle();

  const tirageFait = Boolean(cycle.tirage_effectue_le);

  return {
    nom: cycle.nom,
    theme: cycle.theme,
    details: [
      "Cycle de tontine",
      `Versement mensuel : ${formaterMontant(cycle.montant_mensuel)}`,
      tirageFait ? "Tirage au sort déjà effectué" : "Tirage au sort à venir",
    ],
    dejaMembre: Boolean(participation),
    texteInvitation: "Vous avez été invité à rejoindre ce cycle de tontine.",
    texteDeja: "Vous participez déjà à ce cycle.",
    texteSucces: `Vous participez maintenant au cycle "${cycle.nom}".`,
    libelleRejoindre: "Rejoindre ce cycle",
    confirmation:
      `Confirmer votre participation au cycle "${cycle.nom}" ?` +
      (tirageFait ? "\n\nLe tirage au sort a déjà eu lieu : vous serez placé à la fin de l'ordre de passage." : ""),
    libelleSuite: "Suivre mon cycle",
    routeSuite: "tontine/suivi",
    async rejoindre() {
      const { count } = await supabase
        .from("tontine_participants")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", cycle.id);

      const { error } = await supabase.from("tontine_participants").insert({
        cycle_id: cycle.id,
        membre_id: moiId,
        ordre_tour: (count || 0) + 1,
      });
      if (!error) notifier("Un nouveau membre a rejoint la tontine.");
      return error;
    },
  };
}

// ---------------------------------------------------------
// Affichage
// ---------------------------------------------------------
function afficher(conteneur, invitation) {
  const { nom, theme, details, dejaMembre } = invitation;

  conteneur.innerHTML = `
    ${ENTETE}
    <p class="intro-ouvertures">${echapper(dejaMembre ? invitation.texteDeja : invitation.texteInvitation)}</p>
    ${carteOuverture({ nom, theme, badge: dejaMembre ? "Déjà membre" : "Invitation", details })}
    <div style="margin-top:16px; display:flex; flex-direction:column; gap:10px">
      ${
        dejaMembre
          ? `<button id="bouton-suite" class="bouton bouton-or">${invitation.libelleSuite}</button>`
          : `<button id="bouton-rejoindre" class="bouton bouton-or">${invitation.libelleRejoindre}</button>`
      }
      <button id="bouton-accueil" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte)">Retour à l'accueil</button>
    </div>
    <p id="erreur-invitation" style="color:var(--danger); font-size:13px; margin:12px 0 0" hidden></p>
  `;

  document.getElementById("bouton-accueil").addEventListener("click", () => naviguer("accueil"));
  document.getElementById("bouton-suite")?.addEventListener("click", () => naviguer(invitation.routeSuite));

  document.getElementById("bouton-rejoindre")?.addEventListener("click", async (evenement) => {
    if (!window.confirm(invitation.confirmation)) return;

    const bouton = evenement.currentTarget;
    const erreur = document.getElementById("erreur-invitation");
    erreur.hidden = true;
    bouton.disabled = true;

    const echec = await invitation.rejoindre();
    if (echec) {
      bouton.disabled = false;
      erreur.textContent = "L'opération a échoué : " + echec.message;
      erreur.hidden = false;
      return;
    }

    invitation.dejaMembre = true;
    invitation.texteDeja = invitation.texteSucces;
    afficher(conteneur, invitation);
  });
}

// parametres = [type, référence] extraits de l'adresse
export async function ecranInvitation(conteneur, parametres) {
  const [type, reference] = parametres;
  conteneur.innerHTML = `${ENTETE}<p class="chargement">Chargement…</p>`;

  if (!["cotisation", "tontine"].includes(type) || !reference) {
    rendreMessage(conteneur, "Ce lien d'invitation n'est pas valide.");
    return;
  }

  const moiId = await idProfilCourant();
  const invitation = type === "cotisation" ? await chargerCotisation(reference, moiId) : await chargerTontine(reference, moiId);

  if (!invitation) {
    rendreMessage(
      conteneur,
      type === "cotisation"
        ? "Cette session de cotisation n'est plus ouverte ou n'existe plus."
        : "Ce cycle de tontine n'est plus ouvert ou n'existe plus."
    );
    return;
  }

  afficher(conteneur, invitation);
                          }
