// =========================================================
// CEAI — Boîtes de dialogue de l'application
// Remplacent window.confirm() et alert() du navigateur, qui affichent
// toujours l'adresse du site ("... indique") et ne peuvent pas être
// personnalisées.
//
// Utilisation (dans une fonction async) :
//   if (!(await confirmer("Supprimer cette note ?"))) return;
//   alerter("Erreur : " + error.message);
// Options : { titre, ok, annuler, danger }
// =========================================================

const STYLE = `
.dialogue-fond { position:fixed; inset:0; z-index:9998; display:grid; place-items:center; padding:20px; background:rgba(0,0,0,.55); animation:dialogue-fond .2s ease-out; }
.dialogue-carte { width:100%; max-width:380px; box-sizing:border-box; padding:22px 20px 18px; border:1px solid var(--bordure); border-radius:16px; background:var(--fond-carte); color:var(--texte); box-shadow:0 18px 44px rgba(0,0,0,.35); animation:dialogue-carte .25s ease-out; }
.dialogue-titre { margin:0 0 10px; font-family:var(--police-titre); font-size:19px; font-weight:500; color:var(--texte); }
.dialogue-message { margin:0 0 20px; font-size:14px; line-height:1.55; white-space:pre-line; overflow-wrap:anywhere; color:var(--texte-secondaire); }
.dialogue-actions { display:flex; justify-content:flex-end; gap:10px; }
.dialogue-bouton { padding:10px 18px; font:inherit; font-size:14px; font-weight:600; border:0; border-radius:10px; cursor:pointer; background:var(--fond-carte-claire); color:var(--texte); transition:transform .15s ease; }
.dialogue-bouton:active { transform:scale(.97); }
.dialogue-bouton.principal { background:var(--or, #b9c6bb); color:#3A2B0E; }
.dialogue-bouton.danger { background:var(--danger, #c0392b); color:#fff; }
.dialogue-bouton:focus-visible { outline:2px solid var(--or-texte); outline-offset:2px; }
@keyframes dialogue-fond { from { opacity:0; } to { opacity:1; } }
@keyframes dialogue-carte { from { opacity:0; transform:translateY(10px) scale(.98); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .dialogue-fond, .dialogue-carte { animation:none; } }
`;

function injecterStyle() {
  if (document.getElementById("dialogue-style")) return;
  const style = document.createElement("style");
  style.id = "dialogue-style";
  style.textContent = STYLE;
  document.head.appendChild(style);
}

// boutons : [{ libelle, valeur, classe }] ; "annulation" : valeur renvoyée à Échap, au clic à côté, ou au bouton retour
function afficher({ titre, message, boutons, annulation, focus }) {
  injecterStyle();
  return new Promise((resoudre) => {
    const fond = document.createElement("div");
    fond.className = "dialogue-fond";
    fond.innerHTML = `
      <div class="dialogue-carte" role="alertdialog" aria-modal="true" aria-labelledby="dialogue-titre" aria-describedby="dialogue-message">
        <h2 class="dialogue-titre" id="dialogue-titre"></h2>
        <p class="dialogue-message" id="dialogue-message"></p>
        <div class="dialogue-actions"></div>
      </div>`;
    // textContent : le message n'est jamais interprété comme du HTML
    fond.querySelector(".dialogue-titre").textContent = titre;
    fond.querySelector(".dialogue-message").textContent = String(message ?? "");

    const zone = fond.querySelector(".dialogue-actions");
    const elements = boutons.map((b) => {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = `dialogue-bouton ${b.classe || ""}`.trim();
      bouton.textContent = b.libelle;
      bouton.addEventListener("click", () => fermer(b.valeur));
      zone.appendChild(bouton);
      return bouton;
    });

    let ferme = false;
    function fermer(valeur) {
      if (ferme) return;
      ferme = true;
      document.removeEventListener("keydown", clavier, true);
      window.removeEventListener("hashchange", abandonner);
      window.removeEventListener("popstate", abandonner);
      fond.remove();
      resoudre(valeur);
    }
    const abandonner = () => fermer(annulation);

    function clavier(evenement) {
      if (evenement.key === "Escape") {
        evenement.preventDefault();
        fermer(annulation);
      } else if (evenement.key === "Tab") {
        // le focus reste dans la boîte
        const index = elements.indexOf(document.activeElement);
        const suivant = evenement.shiftKey ? index - 1 : index + 1;
        evenement.preventDefault();
        elements[(suivant + elements.length) % elements.length].focus();
      }
    }

    document.addEventListener("keydown", clavier, true);
    window.addEventListener("hashchange", abandonner);
    window.addEventListener("popstate", abandonner);
    fond.addEventListener("click", (evenement) => {
      if (evenement.target === fond) fermer(annulation);
    });

    document.body.appendChild(fond);
    (elements[focus] || elements[elements.length - 1]).focus();
  });
}

// Renvoie true si la personne confirme, false sinon
export function confirmer(message, options = {}) {
  const texte = String(message ?? "");
  const suppression = /supprim/i.test(texte);
  const danger = options.danger ?? /supprim|irr[ée]versible|rejet|d[ée]finitivement/i.test(texte);
  return afficher({
    titre: options.titre || "Confirmation",
    message: texte,
    annulation: false,
    // en cas de danger, le focus est sur « Annuler » pour éviter une confirmation par erreur
    focus: danger ? 0 : 1,
    boutons: [
      { libelle: options.annuler || "Annuler", valeur: false },
      { libelle: options.ok || (suppression ? "Supprimer" : /rejet/i.test(texte) ? "Rejeter" : "Confirmer"), valeur: true, classe: danger ? "danger" : "principal" },
    ],
  });
}

// Affiche un message avec un seul bouton
export function alerter(message, options = {}) {
  return afficher({
    titre: options.titre || "Information",
    message,
    annulation: undefined,
    focus: 0,
    boutons: [{ libelle: options.ok || "OK", valeur: undefined, classe: "principal" }],
  });
}
