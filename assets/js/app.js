// =========================================================
// CEAI — Point d'entrée
// =========================================================
import { supabase } from "./supabase-client.js";
import { initialiserAuthentification } from "./auth.js";
import { initialiserRouteur } from "./router.js";

const boutonMenu = document.getElementById("bouton-menu");
const menuAccordeon = document.getElementById("menu-accordeon");
const boutonNotifications = document.getElementById("bouton-notifications");
const panneauNotifications = document.getElementById("panneau-notifications");
const listeNotifications = document.getElementById("liste-notifications");
const menuAdmin = document.querySelector(".menu-admin");
const boutonTheme = document.getElementById("bouton-theme");
const iconeTheme = document.getElementById("icone-theme");

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
});

async function chargerNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("texte, cree_le")
    .order("cree_le", { ascending: false })
    .limit(10);

  if (error || !data) return;

  listeNotifications.innerHTML = data.length
    ? data.map((n) => `<li>${n.texte}</li>`).join("")
    : '<li style="color:var(--gris-sauge)">Aucune notification.</li>';
}

// --- Abonnement Realtime aux nouvelles notifications ---------------------
function ecouterNotificationsEnDirect() {
  supabase
    .channel("notifications-en-direct")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      () => {
        document.getElementById("pastille-notifications").hidden = false;
        chargerNotifications();
      }
    )
    .subscribe();
}

// --- Affiche le menu Administration si le profil est admin --------------
async function afficherMenuSelonRole() {
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return;

  const { data: profil } = await supabase
    .from("profils")
    .select("role")
    .eq("id", session.user.id)
    .single();

  menuAdmin.hidden = profil?.role !== "admin";
}

// --- Démarrage -------------------------------------------------------------
document.addEventListener("ceai:connecte", () => {
  document.getElementById("menu-accordeon").hidden = false;
  afficherMenuSelonRole();
  chargerNotifications();
  ecouterNotificationsEnDirect();
  initialiserRouteur();
});

initialiserAuthentification();
