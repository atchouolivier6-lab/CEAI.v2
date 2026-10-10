// =========================================================
// CEAI — Point d'entrée
// =========================================================
import { supabase } from "./supabase-client.js";
import { initialiserAuthentification } from "./auth.js";
import { initialiserRouteur, naviguerVers } from "./router.js";
import { idProfilCourant } from "./mon-profil.js";
import { memoriserInvitationDepuisUrl, afficherBanniereInvitation, consommerInvitation } from "./invitation.js";
import { initialiserPartage } from "./partage.js";
import { initialiserAgents } from "./agents-bouton.js";

const boutonMenu = document.getElementById("bouton-menu");
const menuAccordeon = document.getElementById("menu-accordeon");
const boutonNotifications = document.getElementById("bouton-notifications");
const panneauNotifications = document.getElementById("panneau-notifications");
const listeNotifications = document.getElementById("liste-notifications");
const pastilleNotifications = document.getElementById("pastille-notifications");
const menuAdmin = document.querySelector(".menu-admin");
const boutonTheme = document.getElementById("bouton-theme");
const iconeTheme = document.getElementById("icone-theme");

const CLE_DERNIERE_VISITE = "ceai-dernieres-notifs-vues";

// Routes de l'espace Administration accessibles au comptable.
// L'admin, lui, voit toujours tout le menu sans restriction.
const ROUTES_ADMIN_POUR_COMPTABLE = ["admin/cotisations", "admin/tontine", "admin/epargne", "admin/prets"];

// --- Thème clair / sombre (mémorisé, s'applique uniquement à l'app) -----
const ICONE_SOLEIL = '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';
const ICONE_LUNE = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>';

function appliquerIconeTheme(theme) {
  iconeTheme.innerHTML = theme === "clair" ? ICONE_LUNE : ICONE_SOLEIL;
}

appliquerIconeTheme(document.documentElement.getAttribute("data-theme"));

boutonTheme.addEventListener("click", () => {
  const themeActuel = document.documentElement.getAttribute("data-theme");
  const nouveauTheme = themeActuel === "clair" ? "sombre" : "clair";
  document.documentElement.setAttribute("data-theme", nouveauTheme);
  localStorage.setItem("ceai-theme", nouveauTheme);
  appliquerIconeTheme(nouveauTheme);
});

// --- Ouverture/fermeture du menu accordéon ------------------------------
boutonMenu.addEventListener("click", () => {
  menuAccordeon.hidden = !menuAccordeon.hidden;
  panneauNotifications.hidden = true;
});

document.querySelectorAll(".menu-item-groupe").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    const sousMenu = document.querySelector(`[data-sous-menu="${bouton.dataset.groupe}"]`);
    const ouvert = bouton.getAttribute("aria-expanded") === "true";
    bouton.setAttribute("aria-expanded", String(!ouvert));
    sousMenu.hidden = ouvert;
  });
});

// --- Panneau de notifications --------------------------------------------
boutonNotifications.addEventListener("click", () => {
  panneauNotifications.hidden = !panneauNotifications.hidden;
  menuAccordeon.hidden = true;
  if (!panneauNotifications.hidden) {
    localStorage.setItem(CLE_DERNIERE_VISITE, new Date().toISOString());
    pastilleNotifications.hidden = true;
  }
});

async function chargerNotifications() {
  const moiId = await idProfilCourant();

  const [{ data: notifications }, { count: messagesNonLus }] = await Promise.all([
    supabase.from("notifications").select("texte, cree_le").order("cree_le", { ascending: false }).limit(10),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("destinataire_id", moiId)
      .eq("lu", false),
  ]);

  const ligneMessages =
    messagesNonLus > 0
      ? `<li>
          <button id="ligne-messages-non-lus" style="all:unset; cursor:pointer; color:var(--or-texte); font-weight:500">
            ${messagesNonLus} nouveau${messagesNonLus > 1 ? "x" : ""} message${messagesNonLus > 1 ? "s" : ""}
          </button>
        </li>`
      : "";

  const lignesNotifs = (notifications || []).map((n) => `<li>${n.texte}</li>`).join("");

  listeNotifications.innerHTML =
    ligneMessages + lignesNotifs || '<li style="color:var(--texte-secondaire)">Aucune notification.</li>';

  const boutonMessages = document.getElementById("ligne-messages-non-lus");
  if (boutonMessages) {
    boutonMessages.addEventListener("click", () => {
      panneauNotifications.hidden = true;
      naviguerVers("membres/messagerie");
    });
  }

  const derniereVisite = localStorage.getItem(CLE_DERNIERE_VISITE);
  const notifNonVue = (notifications || []).some((n) => !derniereVisite || n.cree_le > derniereVisite);
  pastilleNotifications.hidden = !(messagesNonLus > 0 || notifNonVue);
}

// --- Abonnement Realtime aux nouvelles notifications et nouveaux messages
function ecouterNotificationsEnDirect() {
  supabase
    .channel("notifications-en-direct")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, chargerNotifications)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, chargerNotifications)
    .subscribe();
}

// --- Affiche le menu Administration selon le rôle --------------------------
// Admin : voit tout, sans restriction.
// Comptable : voit le menu Administration, mais limité à
// Gestion des cotisations, Gestion de la tontine, Gestion de l'épargne
// et Service de prêt.
// Tout autre rôle : menu Administration totalement masqué.
async function afficherMenuSelonRole() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const { data: profil } = await supabase
    .from("profils")
    .select("role")
    .eq("id_auth", session.user.id)
    .single();

  const role = profil?.role;
  const estAdmin = role === "admin";
  const estComptable = role === "comptable";

  menuAdmin.hidden = !estAdmin && !estComptable;

  if (estComptable) {
    document.querySelectorAll('[data-sous-menu="admin"] .menu-item[data-route]').forEach((bouton) => {
      bouton.closest("li").hidden = !ROUTES_ADMIN_POUR_COMPTABLE.includes(bouton.dataset.route);
    });
  }
}

// --- Démarrage -------------------------------------------------------------
document.addEventListener("ceai:connecte", () => {
  document.getElementById("menu-accordeon").hidden = false;
  afficherMenuSelonRole();
  chargerNotifications();
  ecouterNotificationsEnDirect();

  // Lien d'invitation reçu avant la connexion : on va directement à la session ou au cycle
  const invitation = consommerInvitation();
  if (invitation) window.location.hash = invitation;

  initialiserPartage();
  initialiserRouteur();
  initialiserAgents(); // bouton flottant "Discuter avec un agent" (accueil uniquement)
});

// Un lien d'invitation est mémorisé dès l'arrivée, et annoncé sur l'écran de connexion
memoriserInvitationDepuisUrl();
afficherBanniereInvitation();

initialiserAuthentification();
