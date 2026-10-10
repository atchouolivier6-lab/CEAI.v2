// =========================================================
// CEAI — Liens d'invitation : avant et après la connexion
//
// Quand quelqu'un ouvre un lien d'invitation (#invitation/...) :
//  1. le lien est mémorisé dans le navigateur
//  2. s'il n'est pas connecté, l'écran de connexion / inscription
//     affiche une bannière "Vous êtes invité à rejoindre ..."
//  3. dès qu'il est connecté (même après avoir créé son compte),
//     il est dirigé vers la session ou le cycle en question
// =========================================================
import { supabase } from "./supabase-client.js";
import { carteOuverture } from "./ecrans/composants-tableau.js";

const CLE = "ceai-invitation";
const DUREE_MAX = 7 * 24 * 3600 * 1000; // une invitation mémorisée reste valable 7 jours
const MOTIF = /^#?invitation\/(cotisation|tontine)\/([A-Za-z0-9-]{8,80})$/;

const LIBELLES = {
  cotisation: "Session de cotisation",
  tontine: "Cycle de tontine",
};

// À appeler au chargement de la page
export function memoriserInvitationDepuisUrl() {
  const trouve = window.location.hash.match(MOTIF);
  if (!trouve) return;
  try {
    localStorage.setItem(CLE, JSON.stringify({ route: `invitation/${trouve[1]}/${trouve[2]}`, le: Date.now() }));
  } catch {
    // stockage indisponible : le lien reste de toute façon dans l'adresse de la page
  }
}

function lireInvitation() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const { route, le } = JSON.parse(brut);
    if (!route || Date.now() - le > DUREE_MAX) return null;
    return route;
  } catch {
    return null;
  }
}

// Après la connexion : renvoie la route de l'invitation (une seule fois) ou null
export function consommerInvitation() {
  const route = lireInvitation();
  try {
    localStorage.removeItem(CLE);
  } catch {
    // sans importance
  }
  return route;
}

// Bannière affichée sur l'écran de connexion / inscription
export async function afficherBanniereInvitation() {
  const route = lireInvitation();
  if (!route) return;

  const { data: auth } = await supabase.auth.getSession();
  if (auth?.session) return; // déjà connecté : pas de bannière, on va directement à l'invitation

  const logo = document.querySelector("#ecran-auth .logo-auth");
  if (!logo || document.getElementById("banniere-invitation")) return;

  const [, type, ref] = route.split("/");

  // Aperçu public (nom + thème seulement) ; si le script SQL n'est pas installé, on affiche un message général
  let apercu = null;
  try {
    const { data } = await supabase.rpc("invitation_apercu", { p_type: type, p_ref: ref });
    apercu = data?.[0] || null;
  } catch {
    apercu = null;
  }

  const banniere = document.createElement("div");
  banniere.id = "banniere-invitation";
  banniere.className = "invitation-banniere";

  if (apercu) {
    banniere.innerHTML =
      carteOuverture({
        nom: apercu.nom,
        theme: apercu.theme,
        badge: "Invitation",
        details: [
          LIBELLES[type],
          apercu.ouvert
            ? "Connectez-vous ou créez votre compte pour y accéder."
            : "Cette invitation n'est plus ouverte.",
        ],
      }) +
      `<p class="invitation-note">Votre invitation est retenue. Si vous devez confirmer votre adresse e-mail, rouvrez ensuite ce même lien.</p>`;
  } else {
    banniere.innerHTML = `
      <div class="carte">
        <p style="margin:0; font-weight:500">Vous avez été invité à rejoindre CEAI</p>
        <p style="margin:6px 0 0; font-size:13px; color:var(--texte-secondaire)">
          Connectez-vous ou créez votre compte : vous serez ensuite dirigé vers l'invitation.
        </p>
      </div>`;
  }

  logo.insertAdjacentElement("afterend", banniere);
  }
