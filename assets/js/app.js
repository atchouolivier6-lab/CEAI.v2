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
