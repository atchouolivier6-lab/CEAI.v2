// =========================================================
// CEAI — Notifications push (reçues même application fermée)
// - Bloc "Activer les notifications" dans le panneau de la cloche
// - Rappel discret une fois (puis tous les 7 jours si "Plus tard")
// - Enregistre l'appareil du membre dans Supabase (table push_abonnements)
// =========================================================
import { supabase } from "./supabase-client.js";

// Clé PUBLIQUE (sans danger). La clé privée reste uniquement dans Supabase.
const CLE_PUBLIQUE = "BKpeyCGS8e9Pt4tQUYoURZSJRuGa5TGMIg9C7_lM4wsECKk9u-pVSr3vIfFgCyCnWHcjug0lTiKp1Mm2eWF6W9A";

const CLE_RAPPEL = "ceai-push-rappel";
const DELAI_RAPPEL_JOURS = 7;

const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const estInstallee =
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function cleEnOctets(base64url) {
  const rempli = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(rempli), (c) => c.charCodeAt(0));
}

export function pushDisponible() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Attend le service worker, mais pas indéfiniment
function registrationPrete() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("service worker indisponible")), 6000)),
  ]);
}

async function abonnementCourant() {
  const reg = await registrationPrete();
  return reg.pushManager.getSubscription();
}

async function enregistrerAbonnement(abonnement) {
  const json = abonnement.toJSON();
  const { error } = await supabase.rpc("enregistrer_push", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_appareil: navigator.userAgent.slice(0, 120),
  });
  if (error) throw error;
}

// Demande l'autorisation (si besoin), abonne l'appareil et l'enregistre
async function activer() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const reg = await registrationPrete();
  const options = { userVisibleOnly: true, applicationServerKey: cleEnOctets(CLE_PUBLIQUE) };
  let abonnement = await reg.pushManager.getSubscription();
  if (!abonnement) {
    try {
      abonnement = await reg.pushManager.subscribe(options);
    } catch (erreur) {
      // ancien abonnement fait avec une autre clé : on repart de zéro
      const ancien = await reg.pushManager.getSubscription();
      if (ancien) await ancien.unsubscribe();
      abonnement = await reg.pushManager.subscribe(options);
    }
  }
  await enregistrerAbonnement(abonnement);
  return "granted";
}

async function desactiver() {
  const abonnement = await abonnementCourant();
  if (!abonnement) return;
  await supabase.rpc("retirer_push", { p_endpoint: abonnement.endpoint });
  await abonnement.unsubscribe();
}

// --- Bloc dans le panneau de notifications --------------------------------
function installerBloc() {
  const panneau = document.getElementById("panneau-notifications");
  const titre = panneau && panneau.querySelector(".panneau-titre");
  if (!titre) return null;
  const existant = panneau.querySelector(".bloc-push");
  if (existant) return existant;
  const bloc = document.createElement("div");
  bloc.className = "bloc-push";
  titre.insertAdjacentElement("afterend", bloc);
  return bloc;
}

async function dessinerBloc(bloc, messageErreur = "") {
  if (!pushDisponible()) {
    bloc.innerHTML =
      estIOS && !estInstallee
        ? "<p>Sur iPhone, ajoutez d'abord CEAI à l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis ouvrez l'application depuis son icône pour activer les notifications.</p>"
        : "<p>Les notifications ne sont pas disponibles sur ce navigateur.</p>";
    return;
  }
  if (Notification.permission === "denied") {
    bloc.innerHTML =
      "<p>Les notifications sont bloquées pour CEAI. Autorisez-les dans les réglages du navigateur (paramètres du site), puis revenez ici.</p>";
    return;
  }

  let actif = false;
  try {
    actif = Boolean(await abonnementCourant()) && Notification.permission === "granted";
  } catch {
    bloc.innerHTML = "<p>Les notifications ne sont pas disponibles pour le moment. Réessayez plus tard.</p>";
    return;
  }

  bloc.innerHTML = actif
    ? '<p>Notifications activées sur cet appareil.</p><button type="button" class="lien" data-push="desactiver">Désactiver</button>'
    : '<p>Recevez les nouveautés de CEAI sur l\'écran de votre téléphone, même application fermée.</p><button type="button" class="bouton bouton-or" data-push="activer">Activer les notifications</button>';
  if (messageErreur) bloc.insertAdjacentHTML("beforeend", `<p class="push-erreur">${messageErreur}</p>`);

  const bouton = bloc.querySelector("[data-push]");
  bouton.addEventListener("click", async () => {
    bouton.disabled = true;
    try {
      if (bouton.dataset.push === "activer") await activer();
      else await desactiver();
      dessinerBloc(bloc);
    } catch (erreur) {
      console.error(erreur);
      dessinerBloc(bloc, "L'opération a échoué. Réessayez dans un instant.");
    }
  });
}

// --- Rappel discret (une fois, puis tous les 7 jours si "Plus tard") ------
function proposer() {
  if (!pushDisponible() || Notification.permission !== "default") return;
  const dernier = Number(localStorage.getItem(CLE_RAPPEL) || 0);
  if (Date.now() - dernier < DELAI_RAPPEL_JOURS * 86400000) return;
  if (document.querySelector(".push-rappel")) return;

  const barre = document.createElement("div");
  barre.className = "push-rappel";
  barre.setAttribute("role", "dialog");
  barre.setAttribute("aria-label", "Activer les notifications");
  barre.innerHTML = `
    <p>Recevez les nouveautés de CEAI directement sur l'écran de votre téléphone.</p>
    <div class="push-rappel-actions">
      <button type="button" class="bouton bouton-or" data-rappel="oui">Activer</button>
      <button type="button" class="lien" data-rappel="plus-tard">Plus tard</button>
    </div>`;
  document.body.appendChild(barre);

  barre.querySelector('[data-rappel="plus-tard"]').addEventListener("click", () => {
    localStorage.setItem(CLE_RAPPEL, String(Date.now()));
    barre.remove();
  });
  barre.querySelector('[data-rappel="oui"]').addEventListener("click", async () => {
    localStorage.setItem(CLE_RAPPEL, String(Date.now()));
    barre.remove();
    try {
      await activer();
    } catch (erreur) {
      console.error(erreur);
    }
    const bloc = document.querySelector(".bloc-push");
    if (bloc) dessinerBloc(bloc);
  });
}

// Au démarrage : si l'autorisation est déjà donnée, on rattache l'appareil au membre connecté
async function synchroniser() {
  if (!pushDisponible() || Notification.permission !== "granted") return;
  try {
    await activer();
  } catch (erreur) {
    console.error(erreur);
  }
}

let dejaInitialise = false;

export function initialiserPush() {
  if (dejaInitialise) return;
  dejaInitialise = true;

  const bloc = installerBloc();
  if (bloc) {
    dessinerBloc(bloc);
    document.getElementById("bouton-notifications")?.addEventListener("click", () => dessinerBloc(bloc));
  }
  synchroniser();
  setTimeout(proposer, 8000);
                  }
