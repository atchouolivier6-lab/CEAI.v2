// =========================================================
// CEAI — Authentification
// =========================================================
import { supabase } from "./supabase-client.js";

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
    const champ = formulaire.querySelector('input[type="password"], input[type="text"][data-mdp]');
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

  afficherApplication();
});

// --- Inscription -----------------------------------------------------------
formulaireInscription.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  masquerErreur("formulaire-inscription");

  const donnees = new FormData(formulaireInscription);
  const nom = donnees.get("nom");
  const email = donnees.get("email");
  const motDePasse = donnees.get("mot_de_passe");

  const { error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: { data: { nom } },
  });

  if (error) {
    afficherErreur("formulaire-inscription", "Impossible de créer le compte : " + error.message);
    return;
  }

  formulaireInscription.hidden = true;
  texteBasculeInscription.hidden = true;
  messageConfirmationEmail.hidden = false;
});

// --- Déconnexion -----------------------------------------------------------
boutonDeconnexion.addEventListener("click", async () => {
  await supabase.auth.signOut();
  afficherAuthentification();
});

// --- Affichage global --------------------------------------------------
export function afficherApplication() {
  ecranAuth.hidden = true;
  appShell.hidden = false;
  document.dispatchEvent(new CustomEvent("ceai:connecte"));
}

export function afficherAuthentification() {
  appShell.hidden = true;
  ecranAuth.hidden = false;
}

// --- Vérifie la session au chargement -----------------------------------
export async function initialiserAuthentification() {
  supabase.auth.onAuthStateChange((_evenement, session) => {
    if (session) {
      afficherApplication();
    } else {
      afficherAuthentification();
    }
  });
}
