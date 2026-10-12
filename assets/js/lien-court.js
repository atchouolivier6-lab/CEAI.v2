// =========================================================
// CEAI — Raccourcisseur de liens (service gratuit is.gd)
// Transforme le lien complet d'une invitation en un lien court
// qui ne montre pas l'adresse GitHub, avec un nom reconnaissable :
//   https://is.gd/ceai_k7m2qx9p
// Le lien court est mémorisé dans le navigateur : un même lien n'est
// raccourci qu'une fois. Si le service est injoignable, on renvoie null
// et l'appelant utilise le lien complet.
// =========================================================
const CLE_CACHE = "ceai-liens-courts";

function lireCache() {
  try {
    return JSON.parse(localStorage.getItem(CLE_CACHE)) || {};
  } catch {
    return {};
  }
}

function ecrireCache(cache) {
  try {
    localStorage.setItem(CLE_CACHE, JSON.stringify(cache));
  } catch {
    // sans importance : le lien sera simplement redemandé la prochaine fois
  }
}

// Appel "JSONP" : fonctionne depuis une page web sans autorisation spéciale du service
function appelerJsonp(url, delai = 7000) {
  return new Promise((resolve, reject) => {
    const nom = `ceaiLienCourt_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement("script");
    let minuteur = null;

    const nettoyer = () => {
      clearTimeout(minuteur);
      delete window[nom];
      script.remove();
    };

    minuteur = setTimeout(() => {
      nettoyer();
      reject(new Error("délai dépassé"));
    }, delai);

    window[nom] = (reponse) => {
      nettoyer();
      resolve(reponse);
    };
    script.onerror = () => {
      nettoyer();
      reject(new Error("service indisponible"));
    };

    script.src = `${url}&callback=${nom}`;
    document.head.appendChild(script);
  });
}

async function demander(urlLongue, alias) {
  const adresse =
    `https://is.gd/create.php?format=json&url=${encodeURIComponent(urlLongue)}` +
    (alias ? `&shorturl=${encodeURIComponent(alias)}` : "");
  const reponse = await appelerJsonp(adresse);
  return reponse && reponse.shorturl ? reponse.shorturl : null;
}

// alias : nom souhaité pour le lien court (lettres, chiffres, _ ; 5 à 30 caractères)
export async function raccourcirLien(urlLongue, alias = null) {
  const cache = lireCache();
  if (cache[urlLongue]) return cache[urlLongue];

  try {
    let court = await demander(urlLongue, alias);
    // Nom déjà pris (lien déjà créé depuis un autre appareil) : on demande un lien court au hasard
    if (!court && alias) court = await demander(urlLongue, null);
    if (!court) return null;

    cache[urlLongue] = court;
    ecrireCache(cache);
    return court;
  } catch {
    return null;
  }
                                 }
