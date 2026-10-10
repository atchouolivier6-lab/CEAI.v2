// =========================================================
// CEAI — Partage des invitations
// Chaque session de cotisation et chaque cycle de tontine a un lien
// d'invitation qui se déduit de son identifiant : il existe donc
// automatiquement dès l'ouverture, sans rien à créer.
//
// Ce module :
//  - ajoute un bouton "Partager" sous chaque session / cycle
//    (écrans admin et écrans membre), même après un rafraîchissement
//  - ouvre une feuille de partage : WhatsApp, Facebook, Telegram, SMS,
//    e-mail, copie du lien, et le partage natif du téléphone
// =========================================================
import { supabase } from "./supabase-client.js";
import { echapper } from "./ecrans/composants-tableau.js";

const LIBELLES = {
  cotisation: "la session de cotisation",
  tontine: "le cycle de tontine",
};

const TABLES = { cotisation: "cotisation_sessions", tontine: "tontine_cycles" };

// "Janvier 2026 (Aide)" -> "janvier-2026-aide"
function slugifier(nom) {
  return String(nom || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28)
    .replace(/-+$/g, "");
}

// Lien propre à CHAQUE session / cycle : nom lisible + code unique créé à l'ouverture.
// Si le code n'est pas disponible (script SQL pas encore lancé), on utilise l'identifiant complet.
export async function lienInvitation(type, id, nom) {
  const base = window.location.href.split("#")[0];
  let reference = id;
  try {
    const { data } = await supabase.from(TABLES[type]).select("code_invitation").eq("id", id).maybeSingle();
    if (data?.code_invitation) {
      const slug = slugifier(nom);
      reference = slug ? `${slug}-${data.code_invitation}` : data.code_invitation;
    }
  } catch {
    // on garde l'identifiant complet
  }
  return `${base}#invitation/${type}/${reference}`;
}

const ICONES = {
  sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  copier: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
};

function pastille({ couleur, lettre, icone }) {
  if (icone) {
    return `<span class="partage-pastille" style="background:#4b5a52">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[icone]}</svg></span>`;
  }
  return `<span class="partage-pastille" style="background:${couleur}">${lettre}</span>`;
}

// ---------------------------------------------------------
// Feuille de partage
// ---------------------------------------------------------
async function ouvrirFeuille({ type, id, nom }) {
  const lien = await lienInvitation(type, id, nom);
  const intro = `Je vous invite à rejoindre ${LIBELLES[type]} « ${nom} » sur CEAI (Connaissance Entre Amis Intimes).`;
  const message = `${intro} Touchez ce lien pour y accéder : ${lien}`;
  const enc = encodeURIComponent;

  const reseaux = [
    { nom: "WhatsApp", href: `https://wa.me/?text=${enc(message)}`, couleur: "#25D366", lettre: "W", externe: true },
    { nom: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(lien)}`, couleur: "#1877F2", lettre: "f", externe: true },
    { nom: "Telegram", href: `https://t.me/share/url?url=${enc(lien)}&text=${enc(intro)}`, couleur: "#229ED9", lettre: "T", externe: true },
    { nom: "SMS", href: `sms:?&body=${enc(message)}`, icone: "sms" },
    { nom: "E-mail", href: `mailto:?subject=${enc("Invitation CEAI : " + nom)}&body=${enc(message)}`, icone: "mail" },
  ];

  const voile = document.createElement("div");
  voile.className = "partage-voile";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-label", "Partager l'invitation");
  voile.innerHTML = `
    <div class="partage-feuille">
      <div class="partage-entete">
        <p class="partage-titre">Inviter à rejoindre</p>
        <button type="button" class="partage-fermer" aria-label="Fermer">✕</button>
      </div>
      <p class="partage-nom">${echapper(nom)}</p>
      <p class="partage-aide">
        Les personnes qui touchent ce lien arrivent directement sur ${LIBELLES[type]}.
        Si elles n'ont pas encore de compte, elles seront d'abord invitées à s'inscrire.
      </p>

      <div class="partage-lien">
        <input type="text" readonly value="${echapper(lien)}" aria-label="Lien d'invitation" />
        <button type="button" class="bouton bouton-or" data-partage-copier>Copier</button>
      </div>

      <div class="partage-grille">
        ${reseaux
          .map(
            (r) => `
          <a class="partage-reseau" href="${echapper(r.href)}" ${r.externe ? 'target="_blank" rel="noopener"' : ""}>
            ${pastille(r)}<span>${r.nom}</span>
          </a>`
          )
          .join("")}
        <button type="button" class="partage-reseau" data-partage-copier>
          ${pastille({ icone: "copier" })}<span>Copier le lien</span>
        </button>
      </div>

      ${navigator.share ? `<button type="button" class="bouton partage-natif" data-partage-natif>Autres applications…</button>` : ""}
      <p class="partage-retour" aria-live="polite"></p>
    </div>
  `;
  document.body.appendChild(voile);
  document.body.classList.add("tirage-ouvert"); // bloque le défilement de la page derrière

  const retour = voile.querySelector(".partage-retour");
  const champ = voile.querySelector(".partage-lien input");

  const fermer = () => {
    voile.remove();
    document.body.classList.remove("tirage-ouvert");
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
  champ.addEventListener("focus", () => champ.select());

  voile.querySelectorAll("[data-partage-copier]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const copie = await copierTexte(lien, champ);
      retour.textContent = copie ? "Lien copié. Vous pouvez le coller où vous voulez." : "Copie impossible : sélectionnez le lien et copiez-le à la main.";
    });
  });

  voile.querySelector("[data-partage-natif]")?.addEventListener("click", async () => {
    try {
      await navigator.share({ title: `Invitation CEAI : ${nom}`, text: intro, url: lien });
    } catch {
      // l'utilisateur a simplement fermé la fenêtre de partage
    }
  });

  voile.querySelector(".partage-fermer").focus();
}

async function copierTexte(texte, champ) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    try {
      champ.focus();
      champ.select();
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------
// Boutons "Partager" ajoutés automatiquement sous les cartes
// ---------------------------------------------------------
function injecter(zone) {
  // Écrans admin : pied de carte toujours visible, même carte repliée
  zone.querySelectorAll(".ouverture-admin").forEach((carte) => {
    if (carte.querySelector(".ouverture-pied")) return;
    const corps = carte.querySelector("[data-corps]");
    if (!corps) return;

    const type = corps.querySelector("[data-liste-adherents]")
      ? "cotisation"
      : corps.querySelector("[data-liste-participants]")
        ? "tontine"
        : null;
    if (!type) return;

    const pied = document.createElement("div");
    pied.className = "ouverture-pied";
    pied.innerHTML = `<span class="ouverture-pied-texte">Invitez des membres avec un lien direct</span>`;

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton bouton-or partage-bouton";
    bouton.textContent = "Partager";
    bouton.setAttribute("data-partager", "");
    bouton.dataset.type = type;
    bouton.dataset.id = corps.dataset.corps;
    bouton.dataset.nom = carte.querySelector(".ouverture-nom")?.textContent || "";
    pied.appendChild(bouton);

    carte.appendChild(pied);
  });

  // Écrans membre : petit bouton dans la carte (Adhérer / Rejoindre)
  zone.querySelectorAll(".carte-ouverture[data-session], .carte-ouverture[data-cycle]").forEach((carte) => {
    if (carte.querySelector("[data-partager]")) return;
    const estCotisation = carte.hasAttribute("data-session");

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "partage-bouton-carte";
    bouton.textContent = "Partager";
    bouton.setAttribute("data-partager", "");
    bouton.dataset.type = estCotisation ? "cotisation" : "tontine";
    bouton.dataset.id = carte.getAttribute(estCotisation ? "data-session" : "data-cycle");
    bouton.dataset.nom = carte.querySelector(".ouverture-nom")?.textContent || "";
    carte.appendChild(bouton);
  });
}

let initialise = false;

export function initialiserPartage() {
  if (initialise) return;
  const zone = document.getElementById("zone-contenu");
  if (!zone) return;
  initialise = true;

  // Les écrans se redessinent souvent (validation, ajout...) : on réinjecte à chaque fois
  let planifie = false;
  new MutationObserver(() => {
    if (planifie) return;
    planifie = true;
    requestAnimationFrame(() => {
      planifie = false;
      injecter(zone);
    });
  }).observe(zone, { childList: true, subtree: true });

  // Phase de capture : le clic sur "Partager" ne déclenche pas la carte cliquable qui le contient
  zone.addEventListener(
    "click",
    (evenement) => {
      const bouton = evenement.target.closest("[data-partager]");
      if (!bouton) return;
      evenement.stopPropagation();
      evenement.preventDefault();
      ouvrirFeuille({ type: bouton.dataset.type, id: bouton.dataset.id, nom: bouton.dataset.nom });
    },
    true
  );
  zone.addEventListener(
    "keydown",
    (evenement) => {
      if ((evenement.key === "Enter" || evenement.key === " ") && evenement.target.closest("[data-partager]")) {
        evenement.stopPropagation();
      }
    },
    true
  );

  injecter(zone);
    }
