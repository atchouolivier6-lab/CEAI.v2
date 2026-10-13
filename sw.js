// =========================================================
// CEAI — Service worker (application installable)
//
// Stratégie "réseau d'abord" pour les fichiers du site : quand on est
// en ligne, on charge TOUJOURS la dernière version publiée (jamais de
// vieux fichiers mélangés aux nouveaux) ; la copie gardée en mémoire ne
// sert que lorsque la connexion est coupée.
// Les échanges avec la base de données (Supabase) ne sont jamais
// interceptés : les données restent toujours en direct.
//
// Pour forcer le nettoyage des copies anciennes après une grosse mise à
// jour, changez simplement le numéro de VERSION ci-dessous.
// =========================================================
const VERSION = "1";
const CACHE = `ceai-site-v${VERSION}`;

const A_PRECHARGER = [
  "./",
  "index.html",
  "hors-ligne.html",
  "manifest.json",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // un fichier manquant ne doit pas empêcher l'installation
      await Promise.all(A_PRECHARGER.map((adresse) => cache.add(adresse).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(noms.filter((nom) => nom.startsWith("ceai-site-") && nom !== CACHE).map((nom) => caches.delete(nom)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return; // base de données, polices, images externes : on n'y touche pas

  evenement.respondWith(reseauPuisCopie(requete));
});

async function reseauPuisCopie(requete) {
  const cache = await caches.open(CACHE);

  try {
    const reponse = await fetch(requete, { cache: "no-cache" });
    if (reponse && reponse.ok && reponse.status === 200) {
      cache.put(requete, reponse.clone()).catch(() => {});
    }
    return reponse;
  } catch {
    // Hors connexion : copie gardée en mémoire
    const copie = await cache.match(requete);
    if (copie) return copie;

    if (requete.mode === "navigate") {
      return (
        (await cache.match("index.html")) ||
        (await cache.match("./")) ||
        (await cache.match("hors-ligne.html")) ||
        new Response("Vous êtes hors connexion.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
      );
    }
    return new Response("", { status: 504 });
  }
                                                   }
