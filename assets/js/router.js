// =========================================================
// CEAI — Routeur (SPA sans framework)
// Chaque route est associée à une fonction async qui reçoit
// l'élément <main id="zone-contenu"> et y injecte son écran.
// Les écrans détaillés (Cotisation, Tontine, etc.) seront
// ajoutés ici au fur et à mesure, un fichier par domaine.
// =========================================================
import { supabase } from "./supabase-client.js";
import { ecranMonProfil } from "./ecrans/membres-profil.js";
import { ecranAnnuaire } from "./ecrans/membres-annuaire.js";
import { ecranMessagerie } from "./ecrans/membres-messagerie.js";

const zoneContenu = document.getElementById("zone-contenu");

async function ecranAccueil(conteneur) {
  const { data: session } = await supabase.auth.getUser();
  const nom = session?.user?.user_metadata?.nom || "";

  conteneur.innerHTML = `
    <h2 class="titre-section">Accueil</h2>
    <hr class="trait-or" />
    <p style="color:var(--texte-secondaire)">Bienvenue${nom ? " " + nom : ""}.</p>
    <div class="carte">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Capital cotisation</p>
      <p style="font-family:var(--police-titre); font-size:28px; margin:0">—</p>
    </div>
    <div class="carte">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Cycle de tontine en cours</p>
      <p style="margin:0">—</p>
    </div>
    <div class="carte">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Membres actifs</p>
      <p style="margin:0">—</p>
    </div>
  `;
  // Les tirets seront remplacés par de vraies requêtes Supabase
  // (capital_cotisation, tontine_cycles, profils) à l'étape suivante.
}

function ecranProvisoire(titre) {
  return async (conteneur) => {
    conteneur.innerHTML = `
      <h2 class="titre-section">${titre}</h2>
      <hr class="trait-or" />
      <p style="color:var(--texte-secondaire)">Cet écran sera construit à l'étape suivante.</p>
    `;
  };
}

// Table de routage : route -> fonction de rendu
const routes = {
  "accueil": ecranAccueil,
  "cotisation/adherer": ecranProvisoire("Adhérer à la cotisation"),
  "cotisation/suivi": ecranProvisoire("Suivi de mes cotisations"),
  "cotisation/verser": ecranProvisoire("Faire mon versement — Cotisation"),
  "cotisation/archives": ecranProvisoire("Sessions de cotisation clôturées"),
  "tontine/rejoindre": ecranProvisoire("Rejoindre la tontine"),
  "tontine/suivi": ecranProvisoire("Suivi de mon cycle"),
  "tontine/verser": ecranProvisoire("Faire mon versement — Tontine"),
  "tontine/archives": ecranProvisoire("Cycles de tontine clôturés"),
  "publications": ecranProvisoire("Publications"),
  "membres/annuaire": ecranAnnuaire,
  "membres/profil": ecranMonProfil,
  "membres/messagerie": ecranMessagerie,
  "a-propos": ecranProvisoire("À propos"),
  "fondateurs": ecranProvisoire("Fondateurs"),
  "admin/tableau-de-bord": ecranProvisoire("Tableau de bord admin"),
  "admin/membres": ecranProvisoire("Gestion des membres"),
  "admin/cotisations": ecranProvisoire("Gestion des cotisations"),
  "admin/tontine": ecranProvisoire("Gestion de la tontine"),
  "admin/publications": ecranProvisoire("Gestion des publications"),
  "admin/notifications": ecranProvisoire("Gestion des notifications"),
  "admin/statistiques": ecranProvisoire("Statistiques et rapports"),
};

export async function naviguerVers(route) {
  const rendu = routes[route] || routes["accueil"];
  zoneContenu.innerHTML = '<p class="chargement">Chargement…</p>';
  await rendu(zoneContenu);

  document.querySelectorAll(".menu-item[data-route]").forEach((bouton) => {
    bouton.classList.toggle("actif", bouton.dataset.route === route);
  });

  window.location.hash = route;
}

export function initialiserRouteur() {
  document.querySelectorAll(".menu-item[data-route]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      naviguerVers(bouton.dataset.route);
      document.getElementById("menu-accordeon").hidden = true;
    });
  });

  const routeInitiale = window.location.hash.replace("#", "") || "accueil";
  naviguerVers(routeInitiale);
                                       }
