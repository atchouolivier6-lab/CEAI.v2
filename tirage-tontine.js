// =========================================================
// CEAI — Tirage au sort de la tontine (admin uniquement)
//
// 1. Message de confirmation : "Avez-vous atteint le nombre maximum
//    de membres pour votre cycle ?"
// 2. Le tirage est effectué par le SERVEUR (fonction SQL
//    tontine_tirage_au_sort) : une seule fois par cycle, irréversible.
// 3. Animation de suspense : les noms défilent, puis l'ordre de
//    passage est révélé du dernier au premier.
// =========================================================
import { supabase } from "../supabase-client.js";
import { echapper } from "./composants-tableau.js";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function ouvrirVoile(contenu) {
  const voile = document.createElement("div");
  voile.className = "tirage-voile";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.innerHTML = `<div class="tirage-panneau">${contenu}</div>`;
  document.body.appendChild(voile);
  document.body.classList.add("tirage-ouvert");
  return voile;
}

function fermerVoile(voile) {
  voile.remove();
  document.body.classList.remove("tirage-ouvert");
}

// cycleId, nomCycle, nombreParticipants : le cycle concerné
// apresTirage : fonction appelée à la fermeture pour rafraîchir l'écran
export function lancerTirage({ cycleId, nomCycle, nombreParticipants, apresTirage }) {
  if (nombreParticipants < 2) {
    alert("Il faut au moins 2 participants pour effectuer le tirage au sort.");
    return;
  }

  const voile = ouvrirVoile(`
    <p class="tirage-titre">Tirage au sort</p>
    <p class="tirage-cycle">${echapper(nomCycle)} · ${nombreParticipants} participants</p>
    <p class="tirage-question">Avez-vous atteint le nombre maximum de membres pour votre cycle ?</p>
    <p class="tirage-avertissement">
      Le tirage au sort ne peut être effectué qu'une seule fois par cycle, et il est irréversible.
      Les membres qui rejoindront ensuite seront placés à la fin de l'ordre de passage.
    </p>
    <p class="tirage-erreur" hidden></p>
    <div class="tirage-actions">
      <button type="button" class="bouton tirage-bouton-secondaire" data-tirage-non>Pas encore</button>
      <button type="button" class="bouton bouton-or" data-tirage-oui>Oui, lancer le tirage</button>
    </div>
  `);

  voile.querySelector("[data-tirage-non]").addEventListener("click", () => fermerVoile(voile));

  voile.querySelector("[data-tirage-oui]").addEventListener("click", async (evenement) => {
    evenement.currentTarget.disabled = true;

    const { data, error } = await supabase.rpc("tontine_tirage_au_sort", { p_cycle: cycleId });

    if (error || !data || !data.length) {
      const zoneErreur = voile.querySelector(".tirage-erreur");
      zoneErreur.textContent = error?.message || "Le tirage n'a pas pu être effectué.";
      zoneErreur.hidden = false;
      voile.querySelector(".tirage-actions").innerHTML = `<button type="button" class="bouton bouton-or" data-tirage-fermer>Fermer</button>`;
      voile.querySelector("[data-tirage-fermer]").addEventListener("click", () => {
        fermerVoile(voile);
        apresTirage?.();
      });
      return;
    }

    await animerTirage(voile, data, apresTirage);
  });
}

// lignes : [{ rang, nom_membre }] renvoyées par le serveur
async function animerTirage(voile, lignes, apresTirage) {
  const panneau = voile.querySelector(".tirage-panneau");
  const noms = lignes.map((l) => l.nom_membre);
  let passer = false;

  panneau.innerHTML = `
    <p class="tirage-titre">Tirage au sort</p>
    <p class="tirage-etat">Le sort décide…</p>
    <div class="tirage-machine"><span class="tirage-nom-defile">&nbsp;</span></div>
    <div class="tirage-resultats" hidden></div>
    <div class="tirage-actions">
      <button type="button" class="bouton tirage-bouton-secondaire" data-tirage-passer>Passer l'animation</button>
    </div>
  `;
  panneau.querySelector("[data-tirage-passer]").addEventListener("click", () => {
    passer = true;
  });

  // --- Phase 1 : les noms défilent, de plus en plus lentement
  const defile = panneau.querySelector(".tirage-nom-defile");
  if (!mouvementReduit()) {
    let ecoule = 0;
    let delai = 55;
    let dernier = -1;
    while (ecoule < 3200 && !passer) {
      let index;
      do {
        index = Math.floor(Math.random() * noms.length);
      } while (noms.length > 1 && index === dernier);
      dernier = index;
      defile.textContent = noms[index];
      await pause(delai);
      ecoule += delai;
      delai = Math.min(260, delai * 1.07);
    }
  }

  // --- Phase 2 : révélation de l'ordre, du dernier au premier
  panneau.querySelector(".tirage-machine").hidden = true;
  panneau.querySelector(".tirage-etat").textContent = "Voici l'ordre de passage";

  const zone = panneau.querySelector(".tirage-resultats");
  zone.hidden = false;
  zone.innerHTML = lignes
    .map(
      (l) => `
    <div class="tirage-ligne" data-rang="${l.rang}">
      <span class="tirage-rang">${l.rang}</span>
      <span class="tirage-nom-final">?</span>
    </div>`
    )
    .join("");

  const intervalle = lignes.length <= 8 ? 850 : lignes.length <= 15 ? 520 : 300;
  const animer = () => !passer && !mouvementReduit();

  for (const ligneTiree of [...lignes].sort((a, b) => b.rang - a.rang)) {
    const element = zone.querySelector(`[data-rang="${ligneTiree.rang}"]`);

    if (animer()) {
      element.classList.add("tirage-ligne-suspense");
      element.scrollIntoView({ block: "nearest", behavior: "smooth" });
      await pause(intervalle * 0.7);
    }

    element.classList.remove("tirage-ligne-suspense");
    element.querySelector(".tirage-nom-final").textContent = ligneTiree.nom_membre;
    element.classList.add("tirage-ligne-revelee");
    if (ligneTiree.rang === 1) element.classList.add("tirage-ligne-premier");

    if (animer()) await pause(intervalle);
  }

  const premier = lignes.find((l) => l.rang === 1);
  panneau.querySelector(".tirage-etat").textContent = premier
    ? `Premier bénéficiaire : ${premier.nom_membre}`
    : "Tirage terminé";

  panneau.querySelector(".tirage-actions").innerHTML = `<button type="button" class="bouton bouton-or" data-tirage-terminer>Terminer</button>`;
  panneau.querySelector("[data-tirage-terminer]").addEventListener("click", () => {
    fermerVoile(voile);
    apresTirage?.();
  });
}
