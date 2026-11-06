// =========================================================
// CEAI — Visionneuse d'images (plein écran)
// - toucher une image l'ouvre en grand
// - pincer avec deux doigts pour zoomer / dézoomer, glisser pour se déplacer
// - double-toucher pour agrandir ou revenir à la taille normale
// - bouton "Télécharger" pour enregistrer l'image
// - plusieurs images : flèches pour passer de l'une à l'autre
// - le bouton retour du téléphone ferme la visionneuse
// =========================================================
import { lierRetour } from "./retour-fenetre.js";

const ECHELLE_MAX = 6;

const STYLE = `
.visionneuse{position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.95);display:flex;color:#fff;overscroll-behavior:contain}
.visionneuse-scene{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none}
.visionneuse-image{max-width:100%;max-height:100%;object-fit:contain;transform-origin:center center;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;will-change:transform}
.visionneuse-image.anime{transition:transform .2s ease}
.visionneuse-barre{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 14px;background:linear-gradient(to bottom,rgba(0,0,0,.7),transparent)}
.visionneuse-compteur{font:13px system-ui,sans-serif;opacity:.85}
.visionneuse-actions{display:flex;gap:8px;margin-left:auto}
.visionneuse-bouton{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:10px 15px;border-radius:999px;background:rgba(255,255,255,.18);font:500 14px system-ui,sans-serif;color:#fff}
.visionneuse-bouton svg{width:18px;height:18px}
.visionneuse-nav{all:unset;cursor:pointer;position:absolute;top:50%;z-index:2;transform:translateY(-50%);width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.18);font:28px/1 system-ui,sans-serif;color:#fff}
.visionneuse-prec{left:10px}
.visionneuse-suiv{right:10px}
.visionneuse-aide{position:absolute;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2;margin:0;text-align:center;font:12px system-ui,sans-serif;opacity:.75;pointer-events:none;transition:opacity .6s ease}
body.visionneuse-ouverte{overflow:hidden}
`;

const ICONE_TELECHARGER =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>';

function injecterStyle() {
  if (document.getElementById("style-visionneuse")) return;
  const balise = document.createElement("style");
  balise.id = "style-visionneuse";
  balise.textContent = STYLE;
  document.head.appendChild(balise);
}

function limiter(valeur, min, max) {
  return Math.min(max, Math.max(min, valeur));
}

// "…/1730000000000-photo.jpg" -> "photo.jpg"
function nomFichier(url) {
  try {
    const dernier = decodeURIComponent(new URL(url).pathname.split("/").pop() || "image");
    return dernier.replace(/^\d+-/, "") || "image";
  } catch {
    return "image";
  }
}

export function ouvrirVisionneuse(urls, indexDepart = 0) {
  if (!urls || !urls.length || document.querySelector(".visionneuse")) return;
  injecterStyle();

  let index = limiter(indexDepart, 0, urls.length - 1);
  let echelle = 1;
  let tx = 0;
  let ty = 0;

  const voile = document.createElement("div");
  voile.className = "visionneuse";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-label", "Image en grand");
  voile.innerHTML = `
    <div class="visionneuse-scene"><img class="visionneuse-image" alt="" draggable="false" /></div>
    <div class="visionneuse-barre">
      <span class="visionneuse-compteur"></span>
      <div class="visionneuse-actions">
        <button type="button" class="visionneuse-bouton" data-action="telecharger" aria-label="Télécharger l'image">${ICONE_TELECHARGER}<span>Télécharger</span></button>
        <button type="button" class="visionneuse-bouton" data-action="fermer" aria-label="Fermer">✕</button>
      </div>
    </div>
    <button type="button" class="visionneuse-nav visionneuse-prec" data-action="precedente" aria-label="Image précédente">‹</button>
    <button type="button" class="visionneuse-nav visionneuse-suiv" data-action="suivante" aria-label="Image suivante">›</button>
    <p class="visionneuse-aide">Pincez pour zoomer · Double-touchez pour agrandir</p>
  `;
  document.body.appendChild(voile);
  document.body.classList.add("visionneuse-ouverte");

  const scene = voile.querySelector(".visionneuse-scene");
  const image = voile.querySelector(".visionneuse-image");
  const compteur = voile.querySelector(".visionneuse-compteur");
  const aide = voile.querySelector(".visionneuse-aide");
  const boutonTelecharger = voile.querySelector('[data-action="telecharger"] span');
  const plusieurs = urls.length > 1;
  voile.querySelector(".visionneuse-prec").hidden = !plusieurs;
  voile.querySelector(".visionneuse-suiv").hidden = !plusieurs;
  setTimeout(() => (aide.style.opacity = "0"), 3500);

  function appliquer() {
    image.style.transform = `translate(${tx}px, ${ty}px) scale(${echelle})`;
  }

  function contraindre() {
    const zone = scene.getBoundingClientRect();
    const maxX = Math.max(0, (image.offsetWidth * echelle - zone.width) / 2);
    const maxY = Math.max(0, (image.offsetHeight * echelle - zone.height) / 2);
    tx = limiter(tx, -maxX, maxX);
    ty = limiter(ty, -maxY, maxY);
  }

  function reinitialiser() {
    echelle = 1;
    tx = 0;
    ty = 0;
    appliquer();
  }

  function afficher(nouvelIndex) {
    index = (nouvelIndex + urls.length) % urls.length;
    image.src = urls[index];
    compteur.textContent = plusieurs ? `${index + 1} / ${urls.length}` : "";
    reinitialiser();
  }

  // Zoom autour d'un point de l'écran (double-toucher, molette)
  function zoomerEn(nouvelleEchelle, pointX, pointY, avecAnimation = false) {
    const zone = scene.getBoundingClientRect();
    const centreX = zone.left + zone.width / 2;
    const centreY = zone.top + zone.height / 2;
    const suivante = limiter(nouvelleEchelle, 1, ECHELLE_MAX);
    const fx = pointX - centreX;
    const fy = pointY - centreY;
    tx = fx - (suivante / echelle) * (fx - tx);
    ty = fy - (suivante / echelle) * (fy - ty);
    echelle = suivante;
    if (echelle === 1) {
      tx = 0;
      ty = 0;
    }
    contraindre();
    if (avecAnimation) {
      image.classList.add("anime");
      setTimeout(() => image.classList.remove("anime"), 230);
    }
    appliquer();
  }

  // --- Gestes (un doigt : déplacer ; deux doigts : pincer) ---------------
  const pointeurs = new Map();
  let departPincement = null;
  let departGlisse = null;
  let aBouge = false;
  let dernierToucher = { t: 0, x: 0, y: 0 };

  function demarrerPincement() {
    const [a, b] = [...pointeurs.values()];
    departPincement = {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      echelle,
      tx,
      ty,
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
    departGlisse = null;
  }

  scene.addEventListener("pointerdown", (evenement) => {
    scene.setPointerCapture(evenement.pointerId);
    pointeurs.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
    if (pointeurs.size === 1) aBouge = false;
    if (pointeurs.size === 2) {
      aBouge = true;
      demarrerPincement();
    } else if (pointeurs.size === 1) {
      departGlisse = { x: evenement.clientX, y: evenement.clientY, tx, ty };
    }
  });

  scene.addEventListener("pointermove", (evenement) => {
    if (!pointeurs.has(evenement.pointerId)) return;
    pointeurs.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });

    if (pointeurs.size >= 2 && departPincement) {
      const [a, b] = [...pointeurs.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const zone = scene.getBoundingClientRect();
      const ox = zone.left + zone.width / 2;
      const oy = zone.top + zone.height / 2;
      echelle = limiter((departPincement.echelle * distance) / departPincement.distance, 1, ECHELLE_MAX);
      tx = cx - ox - (echelle / departPincement.echelle) * (departPincement.cx - ox - departPincement.tx);
      ty = cy - oy - (echelle / departPincement.echelle) * (departPincement.cy - oy - departPincement.ty);
      if (echelle === 1) {
        tx = 0;
        ty = 0;
      }
      contraindre();
      appliquer();
      return;
    }

    if (pointeurs.size === 1 && departGlisse) {
      const dx = evenement.clientX - departGlisse.x;
      const dy = evenement.clientY - departGlisse.y;
      if (Math.hypot(dx, dy) > 8) aBouge = true;
      if (echelle > 1) {
        tx = departGlisse.tx + dx;
        ty = departGlisse.ty + dy;
        contraindre();
        appliquer();
      }
    }
  });

  function finDeToucher(evenement) {
    const etaitSuivi = pointeurs.delete(evenement.pointerId);
    if (pointeurs.size === 1) {
      // un doigt reste après un pincement : on repart de sa position
      const [reste] = [...pointeurs.values()];
      departGlisse = { x: reste.x, y: reste.y, tx, ty };
      departPincement = null;
      return;
    }
    if (pointeurs.size > 1) return;

    departPincement = null;
    departGlisse = null;
    if (!etaitSuivi || aBouge || evenement.type === "pointercancel") return;

    // Simple toucher ou double-toucher
    const maintenant = Date.now();
    const proche = Math.hypot(evenement.clientX - dernierToucher.x, evenement.clientY - dernierToucher.y) < 35;
    if (maintenant - dernierToucher.t < 320 && proche) {
      dernierToucher = { t: 0, x: 0, y: 0 };
      if (echelle > 1.05) {
        echelle = 1;
        tx = 0;
        ty = 0;
        image.classList.add("anime");
        setTimeout(() => image.classList.remove("anime"), 230);
        appliquer();
      } else {
        zoomerEn(2.6, evenement.clientX, evenement.clientY, true);
      }
      return;
    }
    dernierToucher = { t: maintenant, x: evenement.clientX, y: evenement.clientY };

    // Toucher en dehors de l'image : on ferme
    const cadre = image.getBoundingClientRect();
    const dedans =
      evenement.clientX >= cadre.left && evenement.clientX <= cadre.right && evenement.clientY >= cadre.top && evenement.clientY <= cadre.bottom;
    if (!dedans) setTimeout(() => {
      if (dernierToucher.t === maintenant) fermer();
    }, 330);
  }
  scene.addEventListener("pointerup", finDeToucher);
  scene.addEventListener("pointercancel", finDeToucher);

  // Molette de la souris (ordinateur)
  scene.addEventListener(
    "wheel",
    (evenement) => {
      evenement.preventDefault();
      zoomerEn(echelle * (evenement.deltaY < 0 ? 1.2 : 1 / 1.2), evenement.clientX, evenement.clientY);
    },
    { passive: false }
  );

  // --- Téléchargement -------------------------------------------------------
  async function telecharger() {
    const url = urls[index];
    boutonTelecharger.textContent = "Téléchargement…";
    try {
      const reponse = await fetch(url, { mode: "cors" });
      if (!reponse.ok) throw new Error("téléchargement impossible");
      const blob = await reponse.blob();
      const adresse = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = adresse;
      lien.download = nomFichier(url);
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(adresse), 5000);
    } catch {
      // Secours : on ouvre l'image dans un nouvel onglet (appui long pour l'enregistrer)
      window.open(url, "_blank", "noopener");
    }
    boutonTelecharger.textContent = "Télécharger";
  }

  // --- Boutons, clavier, fermeture ---------------------------------------------
  const surTouche = (evenement) => {
    if (evenement.key === "Escape") fermer();
    else if (evenement.key === "ArrowLeft" && plusieurs) afficher(index - 1);
    else if (evenement.key === "ArrowRight" && plusieurs) afficher(index + 1);
  };

  const nettoyer = () => {
    voile.remove();
    document.body.classList.remove("visionneuse-ouverte");
    document.removeEventListener("keydown", surTouche);
  };
  const detacher = lierRetour(nettoyer);
  function fermer() {
    detacher();
    nettoyer();
  }

  voile.addEventListener("click", (evenement) => {
    const bouton = evenement.target.closest("[data-action]");
    if (!bouton) return;
    const action = bouton.dataset.action;
    if (action === "fermer") fermer();
    else if (action === "telecharger") telecharger();
    else if (action === "precedente") afficher(index - 1);
    else if (action === "suivante") afficher(index + 1);
  });
  document.addEventListener("keydown", surTouche);

  afficher(index);
                              }
