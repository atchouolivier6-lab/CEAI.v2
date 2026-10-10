// =========================================================
// CEAI — Bouton flottant "Discuter avec un agent"
//  - visible UNIQUEMENT sur la page d'accueil
//  - déplaçable au doigt (ou à la souris) ; il se range contre le bord
//    le plus proche et se souvient de son emplacement
//  - touché : ouvre la liste des agents (administrateurs et comptables)
//  - une pastille indique le nombre de messages non lus
// =========================================================
import { supabase } from "./supabase-client.js";
import { idProfilCourant } from "./mon-profil.js";
import { ouvrirFeuilleAgents } from "./agents-feuille.js";

const CLE_POSITION = "ceai-agents-position";
const TAILLE = 58;
const MARGE = 12;

let bouton = null;
let pastille = null;
let moiId = null;
let initialise = false;

function surAccueil() {
  const route = window.location.hash.replace("#", "");
  return route === "" || route === "accueil";
}

const borner = (valeur, min, max) => Math.min(Math.max(valeur, min), max);

// Position mémorisée en proportions (0 à 1), pour rester correcte si l'écran change de taille
function lirePosition() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_POSITION));
    if (p && typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    // position par défaut
  }
  return { x: 1, y: 0.86 };
}

function placer({ x, y }) {
  const largeur = Math.max(window.innerWidth - TAILLE - MARGE * 2, 0);
  const hauteur = Math.max(window.innerHeight - TAILLE - MARGE * 2, 0);
  bouton.style.left = `${MARGE + borner(x, 0, 1) * largeur}px`;
  bouton.style.top = `${MARGE + borner(y, 0, 1) * hauteur}px`;
}

function enregistrer() {
  const largeur = Math.max(window.innerWidth - TAILLE - MARGE * 2, 1);
  const hauteur = Math.max(window.innerHeight - TAILLE - MARGE * 2, 1);
  const x = borner((bouton.offsetLeft - MARGE) / largeur, 0, 1) < 0.5 ? 0 : 1; // se range contre le bord le plus proche
  const y = borner((bouton.offsetTop - MARGE) / hauteur, 0, 1);
  const position = { x, y };
  try {
    localStorage.setItem(CLE_POSITION, JSON.stringify(position));
  } catch {
    // sans importance
  }
  return position;
}

async function rafraichirNonLus() {
  if (!moiId || !pastille) return;
  const { count, error } = await supabase
    .from("agents_messages")
    .select("id", { count: "exact", head: true })
    .neq("expediteur_id", moiId)
    .eq("lu", false);
  const nombre = error ? 0 : count || 0;
  pastille.textContent = nombre > 9 ? "9+" : String(nombre);
  pastille.hidden = nombre === 0;
}

function mettreAJourVisibilite() {
  if (bouton) bouton.hidden = !surAccueil();
}

function creerBouton() {
  bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "agents-fab";
  bouton.setAttribute("aria-label", "Discuter avec un agent");
  bouton.title = "Discuter avec un agent";
  bouton.innerHTML = `
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <path d="M8 9h8M8 13h5"/>
    </svg>
    <span class="agents-fab-pastille" hidden></span>
  `;
  pastille = bouton.querySelector(".agents-fab-pastille");
  document.body.appendChild(bouton);
  placer(lirePosition());

  // --- Glisser-déposer (doigt ou souris)
  let depart = null;
  let deplace = false;
  let ignorerClic = false;

  bouton.addEventListener("pointerdown", (evenement) => {
    depart = { x: evenement.clientX, y: evenement.clientY, gauche: bouton.offsetLeft, haut: bouton.offsetTop };
    deplace = false;
    bouton.classList.remove("agents-fab-aimante");
    bouton.setPointerCapture(evenement.pointerId);
  });

  bouton.addEventListener("pointermove", (evenement) => {
    if (!depart) return;
    const dx = evenement.clientX - depart.x;
    const dy = evenement.clientY - depart.y;
    if (!deplace && Math.hypot(dx, dy) > 8) {
      deplace = true;
      bouton.classList.add("agents-fab-glisse");
    }
    if (deplace) {
      bouton.style.left = `${borner(depart.gauche + dx, MARGE, window.innerWidth - TAILLE - MARGE)}px`;
      bouton.style.top = `${borner(depart.haut + dy, MARGE, window.innerHeight - TAILLE - MARGE)}px`;
    }
  });

  const finGlisser = () => {
    if (!depart) return;
    depart = null;
    bouton.classList.remove("agents-fab-glisse");
    if (deplace) {
      ignorerClic = true; // un glissement ne doit pas ouvrir la liste
      setTimeout(() => (ignorerClic = false), 120);
      bouton.classList.add("agents-fab-aimante");
      placer(enregistrer());
    }
  };
  bouton.addEventListener("pointerup", finGlisser);
  bouton.addEventListener("pointercancel", finGlisser);

  bouton.addEventListener("click", () => {
    if (ignorerClic) return;
    ouvrirFeuilleAgents({ moiId });
  });

  window.addEventListener("resize", () => placer(lirePosition()));
}

export async function initialiserAgents() {
  if (initialise) return;
  initialise = true;

  moiId = await idProfilCourant();
  creerBouton();
  mettreAJourVisibilite();

  // Le bouton n'existe que sur l'accueil : on suit la navigation
  window.addEventListener("hashchange", mettreAJourVisibilite);

  // Pastille des messages non lus, mise à jour en direct
  window.addEventListener("ceai:agents-maj", rafraichirNonLus);
  supabase
    .channel(`agents-pastille-${Date.now()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "agents_messages" }, rafraichirNonLus)
    .subscribe();
  rafraichirNonLus();
}
