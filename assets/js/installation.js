// =========================================================
// CEAI — Installation de l'application (PWA)
//
//  - enregistre le service worker (sw.js) : le site devient installable
//  - Android (Chrome, Edge, Samsung...) et ordinateur (Chrome, Edge) :
//    bouton "Installer" qui ouvre la fenêtre d'installation du navigateur
//  - iPhone / iPad, Firefox, Safari : mode d'emploi adapté à l'appareil
//    (ces navigateurs ne permettent pas d'ouvrir la fenêtre d'installation par programme)
//  - bandeau d'invitation à installer (une fois, repoussable 7 jours)
//  - barre "hors connexion" quand internet est coupé
// =========================================================
import { echapper } from "./ecrans/composants-tableau.js";
import { partagerApplication } from "./partage-application.js";

const CLE_REPORT = "ceai-installation-reportee";
const DELAI_REPORT = 7 * 24 * 3600 * 1000;

let invite = null; // fenêtre d'installation proposée par le navigateur (quand elle existe)

export function estInstallee() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function plateforme() {
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return {
    ios,
    android: /android/i.test(ua),
    firefox: /firefox|fxios/i.test(ua),
    safariMac: /macintosh/i.test(ua) && !ios && /safari/i.test(ua) && !/chrome|crios|chromium|edg|firefox|opr/i.test(ua),
  };
}

// Mode d'emploi selon l'appareil et le navigateur
function etapesInstallation() {
  const p = plateforme();
  if (p.ios) {
    return {
      titre: "Installer sur iPhone / iPad",
      etapes: [
        "Touchez le bouton <strong>Partager</strong> (un carré avec une flèche vers le haut), en bas ou en haut de l'écran.",
        "Faites défiler le menu et touchez <strong>Sur l'écran d'accueil</strong>.",
        "Touchez <strong>Ajouter</strong> : l'icône CEAI apparaît sur votre écran d'accueil.",
      ],
      note: "Si l'option n'apparaît pas, ouvrez ce site avec Safari.",
    };
  }
  if (p.android && p.firefox) {
    return {
      titre: "Installer sur Android (Firefox)",
      etapes: ["Touchez le menu <strong>⋮</strong> du navigateur.", "Touchez <strong>Installer</strong>, puis confirmez."],
      note: "",
    };
  }
  if (p.android) {
    return {
      titre: "Installer sur Android",
      etapes: [
        "Touchez le menu <strong>⋮</strong> du navigateur.",
        "Touchez <strong>Installer l'application</strong> (ou <strong>Ajouter à l'écran d'accueil</strong>).",
        "Confirmez : l'icône CEAI apparaît parmi vos applications.",
      ],
      note: "",
    };
  }
  if (p.safariMac) {
    return {
      titre: "Installer sur Mac (Safari)",
      etapes: ["Dans le menu <strong>Fichier</strong>, choisissez <strong>Ajouter au Dock</strong>.", "Confirmez avec <strong>Ajouter</strong>."],
      note: "",
    };
  }
  if (p.firefox) {
    return {
      titre: "Installer sur ordinateur",
      etapes: ["Firefox ne permet pas d'installer ce type d'application sur ordinateur.", "Ouvrez ce site avec <strong>Chrome</strong> ou <strong>Edge</strong>, puis cliquez sur l'icône d'installation dans la barre d'adresse."],
      note: "",
    };
  }
  return {
    titre: "Installer sur ordinateur",
    etapes: [
      "Cliquez sur l'icône d'installation à droite de la barre d'adresse (un écran avec une flèche).",
      "Ou ouvrez le menu <strong>⋮</strong> du navigateur, puis <strong>Installer CEAI</strong>.",
      "Confirmez : CEAI s'ouvre dans sa propre fenêtre.",
    ],
    note: "",
  };
}

function afficherInstructions() {
  if (document.querySelector(".installation-voile")) return;
  const { titre, etapes, note } = etapesInstallation();

  const voile = document.createElement("div");
  voile.className = "partage-voile installation-voile";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-label", "Installer l'application");
  voile.innerHTML = `
    <div class="partage-feuille">
      <div class="partage-entete">
        <p class="partage-titre">Installer CEAI</p>
        <button type="button" class="partage-fermer" aria-label="Fermer">✕</button>
      </div>
      <p class="partage-nom">${echapper(titre)}</p>
      <p class="partage-aide">CEAI s'ouvre alors comme une vraie application, en plein écran, avec son icône.</p>
      <ol class="installation-etapes">${etapes.map((e) => `<li>${e}</li>`).join("")}</ol>
      ${note ? `<p class="installation-note">${echapper(note)}</p>` : ""}
    </div>
  `;
  document.body.appendChild(voile);

  const fermer = () => {
    voile.remove();
    document.removeEventListener("keydown", surTouche);
  };
  const surTouche = (evenement) => {
    if (evenement.key === "Escape") fermer();
  };
  document.addEventListener("keydown", surTouche);
  voile.addEventListener("click", (evenement) => {
    if (evenement.target === voile) fermer();
  });
  voile.querySelector(".partage-fermer").addEventListener("click", fermer);
}

// Ouvre la fenêtre d'installation du navigateur si elle existe, sinon le mode d'emploi
export async function proposerInstallation() {
  if (invite) {
    const fenetre = invite;
    invite = null; // une fenêtre d'installation ne peut servir qu'une fois
    fenetre.prompt();
    try {
      const choix = await fenetre.userChoice;
      return choix.outcome === "accepted";
    } catch {
      return false;
    }
  }
  afficherInstructions();
  return false;
}

// Les entrées "Installer" disparaissent une fois l'application installée ; "Partager" reste toujours disponible
function mettreAJourMenu() {
  const installee = estInstallee();
  const entree = document.getElementById("menu-installer");
  if (entree) entree.hidden = installee;
  const boutonConnexion = document.getElementById("bouton-installer-auth");
  if (boutonConnexion) boutonConnexion.hidden = installee;
}

// ---------------------------------------------------------
// Bandeau d'invitation (écran de connexion ou après la connexion)
// ---------------------------------------------------------
let bandeauPlanifie = false;

// immediat : arrivée par le lien "Installer CEAI" -> pas d'attente, et on ignore le report
export function afficherBandeauInstallation({ immediat = false } = {}) {
  if (estInstallee() || bandeauPlanifie) return;
  bandeauPlanifie = true;

  setTimeout(() => {
    if (estInstallee() || document.getElementById("bandeau-installation")) return;

    if (!immediat) {
      try {
        if (Date.now() - Number(localStorage.getItem(CLE_REPORT) || 0) < DELAI_REPORT) return;
      } catch {
        // stockage indisponible : on affiche quand même
      }
      // Sans fenêtre native (invite) ni iPhone, le menu garde le mode d'emploi : pas de bandeau
      if (!invite && !plateforme().ios) return;
    }

    const bandeau = document.createElement("div");
    bandeau.id = "bandeau-installation";
    bandeau.className = "bandeau-installation";
    bandeau.innerHTML = `
      <img src="assets/icons/icon-192.png" alt="" />
      <div class="bandeau-texte">
        <p class="bandeau-titre">Installer CEAI</p>
        <p class="bandeau-sous">Accès rapide depuis votre écran d'accueil, en plein écran.</p>
      </div>
      <div class="bandeau-actions">
        <button type="button" class="bouton bouton-or" data-installer>Installer</button>
        <button type="button" class="bandeau-fermer" aria-label="Plus tard" data-plus-tard>✕</button>
      </div>
    `;
    document.body.appendChild(bandeau);

    bandeau.querySelector("[data-installer]").addEventListener("click", async () => {
      bandeau.remove();
      await proposerInstallation();
    });
    bandeau.querySelector("[data-plus-tard]").addEventListener("click", () => {
      try {
        localStorage.setItem(CLE_REPORT, String(Date.now()));
      } catch {
        // sans importance
      }
      bandeau.remove();
    });
  }, immediat ? 600 : 4000);
}

// ---------------------------------------------------------
// Barre "hors connexion"
// ---------------------------------------------------------
function suivreConnexion() {
  const barre = document.createElement("div");
  barre.className = "barre-hors-ligne";
  barre.setAttribute("role", "status");
  barre.textContent = "Vous êtes hors connexion : certaines données ne peuvent pas se charger.";
  barre.hidden = navigator.onLine;
  document.body.appendChild(barre);
  window.addEventListener("offline", () => (barre.hidden = false));
  window.addEventListener("online", () => (barre.hidden = true));
}

// ---------------------------------------------------------
// Démarrage (à appeler une fois, dès le chargement de la page)
// ---------------------------------------------------------
export function initialiserInstallation() {
  // Service worker : seulement en https (ou en local)
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(new URL("sw.js", document.baseURI).href).catch(() => {});
    });
  }

  window.addEventListener("beforeinstallprompt", (evenement) => {
    evenement.preventDefault(); // on garde la fenêtre pour l'ouvrir au bon moment
    invite = evenement;
  });

  window.addEventListener("appinstalled", () => {
    invite = null;
    document.getElementById("bandeau-installation")?.remove();
    mettreAJourMenu();
  });

  // Menu : installer et partager (toujours disponibles)
  const fermerMenu = () => {
    const menu = document.getElementById("menu-accordeon");
    if (menu) menu.hidden = true;
  };
  document.getElementById("bouton-installer")?.addEventListener("click", () => {
    fermerMenu();
    proposerInstallation();
  });
  document.getElementById("bouton-partager-app")?.addEventListener("click", () => {
    fermerMenu();
    partagerApplication();
  });
  // Écran de connexion : installer sans même avoir de compte
  document.getElementById("bouton-installer-auth")?.addEventListener("click", proposerInstallation);

  mettreAJourMenu();
  suivreConnexion();

  // Arrivée par un lien "Installer CEAI" partagé par quelqu'un : on propose l'installation tout de suite
  const arriveeParLien = window.location.hash === "#installer";
  if (arriveeParLien) history.replaceState(null, "", window.location.pathname + window.location.search);
  if (arriveeParLien && !estInstallee()) {
    if (plateforme().ios) afficherInstructions();
    else afficherBandeauInstallation({ immediat: true });
  }

  // Sinon : invitation discrète (reportable 7 jours), dès l'écran de connexion
  afficherBandeauInstallation();
                                                               }
