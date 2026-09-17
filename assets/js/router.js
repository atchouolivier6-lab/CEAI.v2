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
import { ecranCotisationAdherer, ecranCotisationSuivi, ecranCotisationVerser } from "./ecrans/cotisation-membre.js";
import { ecranCotisationArchives } from "./ecrans/cotisation-archives.js";
import { ecranTontineRejoindre, ecranTontineSuivi, ecranTontineVerser } from "./ecrans/tontine-membre.js";
import { ecranTontineArchives } from "./ecrans/tontine-archives.js";
import { ecranAPropos } from "./ecrans/a-propos.js";
import { ecranFondateurs } from "./ecrans/fondateurs.js";
import { ecranPublications } from "./ecrans/publications.js";
import { ecranAdminCotisations } from "./ecrans/admin-cotisations.js";
import { ecranAdminTontine } from "./ecrans/admin-tontine.js";
import { ecranAdminMembres } from "./ecrans/admin-membres.js";
import { ecranDemandePret } from "./ecrans/demande-pret.js";
import { ecranAdminPrets } from "./ecrans/admin-prets.js";
import { ecranAdminNotifications } from "./ecrans/admin-notifications.js";
import { ecranAdminTableauBord, ecranAdminStatistiques } from "./ecrans/admin-stats.js";
import { ecranAdminPublications } from "./ecrans/admin-publications.js";

const zoneContenu = document.getElementById("zone-contenu");

async function ecranAccueil(conteneur) {
  const { data: session } = await supabase.auth.getUser();
  const nom = session?.user?.user_metadata?.nom || "";

  conteneur.innerHTML = `
    <h2 class="titre-section">Accueil</h2>
    <hr class="trait-or" />
    <p style="color:var(--texte-secondaire)">Bienvenue${nom ? " " + nom : ""}.</p>
    <p class="chargement">Chargement…</p>
  `;

  const [{ data: capital }, { data: cyclesOuverts }, { count: membresActifs }, { data: dernieresPublications }] =
    await Promise.all([
      supabase.from("capital_cotisation").select("total").maybeSingle(),
      supabase.from("tontine_cycles").select("nom").eq("statut", "ouvert").order("demarre_le", { ascending: false }),
      supabase.from("profils").select("id", { count: "exact", head: true }).eq("actif", true),
      supabase.from("publications").select("id, texte, cree_le").order("cree_le", { ascending: false }).limit(3),
    ]);

  const texteCycle = !cyclesOuverts || !cyclesOuverts.length
    ? "Aucun cycle en cours"
    : cyclesOuverts.length === 1
      ? cyclesOuverts[0].nom
      : `${cyclesOuverts.length} cycles en cours`;

  conteneur.innerHTML = `
    <h2 class="titre-section">Accueil</h2>
    <hr class="trait-or" />
    <p style="color:var(--texte-secondaire)">Bienvenue${nom ? " " + nom : ""}.</p>
    <div class="carte">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Capital cotisation</p>
      <p style="font-family:var(--police-titre); font-size:28px; margin:0">${Number(capital?.total || 0).toLocaleString("fr-FR")} FCFA</p>
    </div>
    <div class="carte">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Cycle de tontine en cours</p>
      <p style="margin:0">${texteCycle}</p>
    </div>
    <div class="carte">
      <p style="color:var(--texte-secondaire); font-size:13px; margin:0 0 4px">Membres actifs</p>
      <p style="margin:0">${membresActifs || 0}</p>
    </div>
    ${
      dernieresPublications && dernieresPublications.length
        ? `<p style="font-weight:500; margin:20px 0 8px">Dernières publications</p>` +
          dernieresPublications
            .map(
              (p) => `
          <div class="carte">
            <p style="margin:0; font-size:14px">${p.texte ? p.texte.slice(0, 120) + (p.texte.length > 120 ? "…" : "") : "(média)"}</p>
          </div>
        `
            )
            .join("")
        : ""
    }
  `;
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
  "cotisation/adherer": ecranCotisationAdherer,
  "cotisation/suivi": ecranCotisationSuivi,
  "cotisation/verser": ecranCotisationVerser,
  "cotisation/archives": ecranCotisationArchives,
  "tontine/rejoindre": ecranTontineRejoindre,
  "tontine/suivi": ecranTontineSuivi,
  "tontine/verser": ecranTontineVerser,
  "tontine/archives": ecranTontineArchives,
  "publications": ecranPublications,
  "prets": ecranDemandePret,
  "membres/annuaire": ecranAnnuaire,
  "membres/profil": ecranMonProfil,
  "membres/messagerie": ecranMessagerie,
  "a-propos": ecranAPropos,
  "fondateurs": ecranFondateurs,
  "admin/tableau-de-bord": ecranAdminTableauBord,
  "admin/membres": ecranAdminMembres,
  "admin/cotisations": ecranAdminCotisations,
  "admin/tontine": ecranAdminTontine,
  "admin/publications": ecranAdminPublications,
  "admin/notifications": ecranAdminNotifications,
  "admin/prets": ecranAdminPrets,
  "admin/statistiques": ecranAdminStatistiques,
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
  window.addEventListener("ceai:naviguer", (evenement) => naviguerVers(evenement.detail));

  document.querySelectorAll(".menu-item[data-route]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      naviguerVers(bouton.dataset.route);
      document.getElementById("menu-accordeon").hidden = true;
    });
  });

  const routeInitiale = window.location.hash.replace("#", "") || "accueil";
  naviguerVers(routeInitiale);
  }
