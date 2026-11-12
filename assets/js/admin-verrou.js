// =========================================================
// CEAI — Verrou de l'espace Administration
// - Première fois : l'agent crée un code de 4 à 6 chiffres et le confirme.
// - Ensuite : le code est demandé à chaque entrée dans l'espace.
// - L'espace se reverrouille tout seul : en quittant l'espace Administration,
//   en quittant ou en réduisant l'application.
// Le code est vérifié par la base (fonctions de admin-verrou.sql).
// =========================================================
import { supabase } from "./supabase-client.js";

let deverrouille = false;
let demandeEnCours = null;
let installe = false;

export function verrouillerAdmin() {
  deverrouille = false;
}

// Demande le code si l'espace est verrouillé. Renvoie true si l'accès est accordé.
export function exigerCodeAdmin() {
  if (deverrouille) return Promise.resolve(true);
  if (!demandeEnCours) {
    demandeEnCours = ouvrirVerrou().finally(() => {
      demandeEnCours = null;
    });
  }
  return demandeEnCours;
}

// À appeler une fois au démarrage du routeur
export function installerVerrouAdmin() {
  if (installe) return;
  installe = true;

  // Application réduite ou quittée : on verrouille ; au retour, le code est redemandé
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
      verrouillerAdmin();
      return;
    }
    if (location.hash.startsWith("#admin/") && !deverrouille) {
      const ok = await exigerCodeAdmin();
      if (!ok && location.hash.startsWith("#admin/")) {
        window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: "accueil" }));
      }
    }
  });
  window.addEventListener("pagehide", verrouillerAdmin);

  // Menu : toucher « Administration » demande d'abord le code
  const menu = document.getElementById("menu-accordeon");
  if (menu) {
    menu.addEventListener(
      "click",
      async (evenement) => {
        const bouton = evenement.target.closest('[data-groupe="admin"]');
        if (!bouton || deverrouille) return;
        evenement.stopPropagation();
        evenement.preventDefault();
        if (await exigerCodeAdmin()) bouton.click();
      },
      true
    );
  }
}

// ---------------------------------------------------------
// Fenêtre de saisie du code
// ---------------------------------------------------------
const CADENAS =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

const STYLE = `
.verrou-fond { position:fixed; inset:0; z-index:9999; display:grid; place-items:center; padding:20px; background:var(--fond); overflow-y:auto; }
.verrou-carte { width:100%; max-width:360px; box-sizing:border-box; padding:28px 22px 22px; text-align:center; border:1px solid var(--bordure); border-radius:18px; background:var(--fond-carte); box-shadow:var(--ombre-douce); animation:verrou-entree .4s ease-out backwards; }
.verrou-icone { display:grid; place-items:center; width:52px; height:52px; margin:0 auto 14px; border-radius:50%; background:var(--fond-carte-claire); color:var(--or-texte); }
.verrou-titre { margin:0; font-family:var(--police-titre); font-size:22px; font-weight:500; color:var(--texte); }
.verrou-texte { margin:8px 0 18px; font-size:13px; line-height:1.5; color:var(--texte-secondaire); }
.verrou-formulaire { display:flex; flex-direction:column; gap:14px; text-align:left; }
.verrou-champ span { display:block; margin-bottom:6px; font-size:12px; color:var(--texte-secondaire); }
.verrou-champ input { width:100%; box-sizing:border-box; padding:12px; text-align:center; font-size:22px; letter-spacing:.5em; color:var(--texte); background:var(--fond); border:1px solid var(--bordure); border-radius:10px; }
.verrou-erreur { min-height:18px; margin:0; text-align:center; font-size:13px; color:var(--danger); }
.verrou-actions { display:flex; flex-direction:column; gap:8px; }
.verrou-lien { padding:8px; font-size:13px; color:var(--texte-secondaire); background:none; border:0; text-decoration:underline; cursor:pointer; }
@keyframes verrou-entree { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .verrou-carte { animation:none; } }
`;

function injecterStyle() {
  if (document.getElementById("verrou-admin-style")) return;
  const style = document.createElement("style");
  style.id = "verrou-admin-style";
  style.textContent = STYLE;
  document.head.appendChild(style);
}

const champ = (id, libelle) =>
  `<label class="verrou-champ"><span>${libelle}</span>
     <input id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" />
   </label>`;

function entete(titre, texte) {
  return `<div class="verrou-icone">${CADENAS}</div><h2 class="verrou-titre">${titre}</h2><p class="verrou-texte">${texte}</p>`;
}

const codeValide = (code) => /^[0-9]{4,6}$/.test(code);

function ouvrirVerrou() {
  injecterStyle();

  const fond = document.createElement("div");
  fond.className = "verrou-fond";
  fond.innerHTML = `<div class="verrou-carte" role="dialog" aria-modal="true" aria-label="Espace sécurisé"><p class="verrou-texte">Chargement…</p></div>`;
  document.body.appendChild(fond);
  const carte = fond.firstElementChild;

  return new Promise((resoudre) => {
    let termine = false;
    let minuteur = null;

    const terminer = (accorde) => {
      if (termine) return;
      termine = true;
      clearInterval(minuteur);
      window.removeEventListener("hashchange", annuler);
      fond.remove();
      if (accorde) deverrouille = true;
      resoudre(accorde);
    };
    const annuler = () => terminer(false);
    // Le bouton retour du téléphone change l'adresse : on ferme la fenêtre
    window.addEventListener("hashchange", annuler);

    const brancher = () => {
      carte.querySelectorAll("input").forEach((champSaisie) => {
        champSaisie.addEventListener("input", () => {
          champSaisie.value = champSaisie.value.replace(/\D/g, "");
        });
      });
      carte.querySelector('[data-annuler]')?.addEventListener("click", annuler);
      carte.querySelector("input")?.focus();
    };

    const erreur = (texte) => {
      const zone = carte.querySelector(".verrou-erreur");
      if (zone) zone.textContent = texte;
    };

    // ----- Première fois : créer le code et le confirmer -----
    const vueCreation = () => {
      carte.innerHTML = `
        ${entete("Sécurisez l'espace Administration", "Choisissez un code de 4 à 6 chiffres. Il vous sera demandé à chaque ouverture de cet espace.")}
        <form class="verrou-formulaire">
          ${champ("verrou-code", "Votre code (4 à 6 chiffres)")}
          ${champ("verrou-confirmation", "Confirmez le même code")}
          <p class="verrou-erreur"></p>
          <div class="verrou-actions">
            <button type="submit" class="bouton bouton-or">Valider et accéder</button>
            <button type="button" class="bouton" data-annuler style="background:var(--fond-carte-claire); color:var(--texte)">Annuler</button>
          </div>
        </form>`;
      brancher();
      carte.querySelector("form").addEventListener("submit", async (evenement) => {
        evenement.preventDefault();
        const code = carte.querySelector("#verrou-code").value;
        const confirmation = carte.querySelector("#verrou-confirmation").value;
        if (!codeValide(code)) return erreur("Le code doit contenir de 4 à 6 chiffres.");
        if (code !== confirmation) return erreur("Les deux codes ne correspondent pas.");
        const { error } = await supabase.rpc("admin_code_definir", { p_code: code });
        if (error) return erreur(error.message);
        terminer(true);
      });
    };

    // ----- Entrée du code -----
    const vueSaisie = () => {
      carte.innerHTML = `
        ${entete("Espace Administration", "Entrez votre code de sécurité pour continuer.")}
        <form class="verrou-formulaire">
          ${champ("verrou-code", "Code de sécurité")}
          <p class="verrou-erreur"></p>
          <div class="verrou-actions">
            <button type="submit" class="bouton bouton-or">Déverrouiller</button>
            <button type="button" class="bouton" data-annuler style="background:var(--fond-carte-claire); color:var(--texte)">Annuler</button>
            <button type="button" class="verrou-lien" data-changer>Changer mon code</button>
          </div>
        </form>`;
      brancher();
      const bouton = carte.querySelector('button[type="submit"]');
      const saisie = carte.querySelector("#verrou-code");

      const bloquer = (secondes) => {
        clearInterval(minuteur);
        let reste = secondes;
        bouton.disabled = true;
        saisie.disabled = true;
        const afficher = () => {
          const minutes = Math.floor(reste / 60);
          erreur(`Trop d'essais. Réessayez dans ${minutes} min ${String(reste % 60).padStart(2, "0")} s.`);
        };
        afficher();
        minuteur = setInterval(() => {
          reste -= 1;
          if (reste <= 0) {
            clearInterval(minuteur);
            bouton.disabled = false;
            saisie.disabled = false;
            erreur("");
            saisie.focus();
          } else {
            afficher();
          }
        }, 1000);
      };

      carte.querySelector("[data-changer]").addEventListener("click", vueChangement);
      carte.querySelector("form").addEventListener("submit", async (evenement) => {
        evenement.preventDefault();
        const code = saisie.value;
        if (!codeValide(code)) return erreur("Entrez votre code de 4 à 6 chiffres.");
        bouton.disabled = true;
        const { data, error } = await supabase.rpc("admin_code_verifier", { p_code: code });
        bouton.disabled = false;
        if (error) return erreur("Vérification impossible pour le moment.");
        if (data?.etat === "ok") return terminer(true);
        saisie.value = "";
        if (data?.etat === "bloque") return bloquer(Number(data.secondes) || 300);
        if (data?.etat === "absent") return vueCreation();
        erreur(`Code incorrect. Il vous reste ${data?.restant ?? 0} essai${data?.restant > 1 ? "s" : ""}.`);
        saisie.focus();
      });
    };

    // ----- Changer le code -----
    const vueChangement = () => {
      carte.innerHTML = `
        ${entete("Changer mon code", "Entrez votre code actuel, puis choisissez le nouveau.")}
        <form class="verrou-formulaire">
          ${champ("verrou-ancien", "Code actuel")}
          ${champ("verrou-code", "Nouveau code (4 à 6 chiffres)")}
          ${champ("verrou-confirmation", "Confirmez le nouveau code")}
          <p class="verrou-erreur"></p>
          <div class="verrou-actions">
            <button type="submit" class="bouton bouton-or">Enregistrer et accéder</button>
            <button type="button" class="bouton" data-retour style="background:var(--fond-carte-claire); color:var(--texte)">Retour</button>
          </div>
        </form>`;
      brancher();
      carte.querySelector("[data-retour]").addEventListener("click", vueSaisie);
      carte.querySelector("form").addEventListener("submit", async (evenement) => {
        evenement.preventDefault();
        const ancien = carte.querySelector("#verrou-ancien").value;
        const code = carte.querySelector("#verrou-code").value;
        const confirmation = carte.querySelector("#verrou-confirmation").value;
        if (!codeValide(ancien)) return erreur("Entrez votre code actuel.");
        if (!codeValide(code)) return erreur("Le nouveau code doit contenir de 4 à 6 chiffres.");
        if (code !== confirmation) return erreur("Les deux nouveaux codes ne correspondent pas.");
        const { data, error } = await supabase.rpc("admin_code_changer", { p_ancien: ancien, p_nouveau: code });
        if (error) return erreur(error.message);
        if (!data) return erreur("Le code actuel est incorrect (ou le compte est bloqué quelques minutes).");
        terminer(true);
      });
    };

    // ----- Départ : un code existe-t-il déjà ? -----
    supabase.rpc("admin_code_existe").then(({ data, error }) => {
      if (termine) return;
      if (error) {
        carte.innerHTML = `
          ${entete("Verrou indisponible", "Le verrou de l'espace Administration n'est pas encore installé sur la base de données.")}
          <div class="verrou-actions"><button type="button" class="bouton" data-annuler style="background:var(--fond-carte-claire); color:var(--texte)">Retour</button></div>`;
        brancher();
        return;
      }
      if (data) vueSaisie();
      else vueCreation();
    });
  });
          }
