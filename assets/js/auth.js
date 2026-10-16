// =========================================================
// CEAI — Authentification
// Au démarrage, un écran de chargement (logo) reste affiché le temps
// de relire la session enregistrée : plus de passage par la page de
// connexion à l'actualisation.
// =========================================================
import { supabase } from "./supabase-client.js";

const ecranDemarrage = document.getElementById("ecran-demarrage");
const ecranAuth = document.getElementById("ecran-auth");
const appShell = document.getElementById("app-shell");

const formulaireConnexion = document.getElementById("formulaire-connexion");
const formulaireInscription = document.getElementById("formulaire-inscription");
const boutonVersInscription = document.getElementById("bouton-vers-inscription");
const boutonVersConnexion = document.getElementById("bouton-vers-connexion");
const texteBasculeConnexion = document.getElementById("texte-bascule-connexion");
const texteBasculeInscription = document.getElementById("texte-bascule-inscription");
const messageConfirmationEmail = document.getElementById("message-confirmation-email");
const boutonDeconnexion = document.getElementById("bouton-deconnexion");

let applicationAffichee = false;

function afficherErreur(formulaireId, texte) {
  const p = document.querySelector(`[data-erreur-pour="${formulaireId}"]`);
  p.textContent = texte;
  p.hidden = false;
}

function masquerErreur(formulaireId) {
  const p = document.querySelector(`[data-erreur-pour="${formulaireId}"]`);
  p.hidden = true;
}

// --- Bascule connexion / inscription -----------------------------------
boutonVersInscription.addEventListener("click", () => {
  formulaireConnexion.hidden = true;
  formulaireInscription.hidden = false;
  texteBasculeConnexion.hidden = true;
  texteBasculeInscription.hidden = false;
  messageConfirmationEmail.hidden = true;
});

boutonVersConnexion.addEventListener("click", () => {
  formulaireInscription.hidden = true;
  formulaireConnexion.hidden = false;
  texteBasculeInscription.hidden = true;
  texteBasculeConnexion.hidden = false;
  messageConfirmationEmail.hidden = true;
});

// --- Icône œil : afficher/masquer le mot de passe -----------------------
document.querySelectorAll(".bouton-oeil").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    const formulaire = document.getElementById(bouton.dataset.cible);
    const input = formulaire.querySelector('input[name="mot_de_passe"]');
    input.type = input.type === "password" ? "text" : "password";
  });
});

// --- Connexion -----------------------------------------------------------
formulaireConnexion.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  masquerErreur("formulaire-connexion");

  const donnees = new FormData(formulaireConnexion);
  const email = donnees.get("email");
  const motDePasse = donnees.get("mot_de_passe");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse,
  });

  if (error) {
    afficherErreur(
      "formulaire-connexion",
      error.message.includes("Email not confirmed")
        ? "Veuillez confirmer votre email avant de vous connecter."
        : "Email ou mot de passe incorrect."
    );
    return;
  }

  afficherApplication(true);
});

// --- Inscription -----------------------------------------------------------
formulaireInscription.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  masquerErreur("formulaire-inscription");

  const donnees = new FormData(formulaireInscription);
  const nom = donnees.get("nom");
  const email = donnees.get("email");
  const motDePasse = donnees.get("mot_de_passe");

  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: { data: { nom } },
  });

  if (error) {
    afficherErreur("formulaire-inscription", "Impossible de créer le compte : " + error.message);
    return;
  }

  if (data.session) {
    // Confirmation email désactivée : le compte est actif immédiatement,
    // l'application s'affiche via onAuthStateChange.
    return;
  }

  formulaireInscription.hidden = true;
  texteBasculeInscription.hidden = true;
  messageConfirmationEmail.hidden = false;
});

// --- Déconnexion : on recharge la page pour repartir proprement ----------
boutonDeconnexion.addEventListener("click", async () => {
  await supabase.auth.signOut();
  history.replaceState(null, "", window.location.pathname);
  window.location.reload();
});

// --- Affichage global --------------------------------------------------
// "connexion" = vrai si l'utilisateur vient de saisir ses identifiants.
// L'événement ceai:connecte n'est envoyé qu'UNE fois par chargement de page.
export function afficherApplication(connexion = false) {
  ecranDemarrage.hidden = true;
  ecranAuth.hidden = true;
  appShell.hidden = false;
  if (applicationAffichee) return;
  applicationAffichee = true;
  document.dispatchEvent(new CustomEvent("ceai:connecte", { detail: { connexion } }));
}

export function afficherAuthentification() {
  applicationAffichee = false;
  ecranDemarrage.hidden = true;
  appShell.hidden = true;
  ecranAuth.hidden = false;
}

// --- Vérifie la session au chargement -----------------------------------
export async function initialiserAuthentification() {
  // Sécurité : si la lecture de la session traîne (réseau faible),
  // on finit par proposer la connexion ; l'application reprendra
  // automatiquement la main si la session est bien retrouvée ensuite.
  const secours = setTimeout(() => {
    if (!applicationAffichee) afficherAuthentification();
  }, 8000);

  try {
    const { data } = await supabase.auth.getSession();
    clearTimeout(secours);
    if (data?.session) afficherApplication(false);
    else afficherAuthentification();
  } catch {
    clearTimeout(secours);
    afficherAuthentification();
  }

  supabase.auth.onAuthStateChange((evenement, session) => {
    if (evenement === "SIGNED_OUT") {
      afficherAuthentification();
      return;
    }
    if (session) afficherApplication(false);
  });
                                     }
