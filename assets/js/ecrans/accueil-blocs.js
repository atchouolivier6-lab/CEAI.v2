// =========================================================
// CEAI — Blocs de l'accueil (style classique, tons neutres)
// Tuiles de chiffres, prochain bénéficiaire, activités récentes,
// dernières publications. Les styles sont dans accueil-classique.css.
// =========================================================
import { icone, echapper, tempsRelatif, formaterMontant } from "./composants-tableau.js";

// Icônes supplémentaires (en plus de celles de composants-tableau.js)
const EXTRA = {
  cloche: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  publication:
    '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  cloture: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};

function svg(nom, taille = 16) {
  if (!EXTRA[nom]) return icone(nom, taille);
  return `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EXTRA[nom]}</svg>`;
}

// Le premier motif qui correspond au texte de la notification décide de l'icône
const TYPES = [
  [/cl[oô]tur/i, "cloture"],
  [/[ée]pargne|retrait/i, "epargne"],
  [/tontine|cycle|tirage/i, "tontine"],
  [/cotisation|versement|session|bilan/i, "cotisation"],
  [/pr[êe]t/i, "pret"],
  [/publi/i, "publication"],
  [/message/i, "message"],
  [/membre|adh[ée]r|rejoint|inscri/i, "membres"],
];
const UNE_JOURNEE = 24 * 3600 * 1000;

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

// ---------------------------------------------------------
// Bandeau de bienvenue
// ---------------------------------------------------------
export function blocHero({ nom, date }) {
  return `
    <section class="acc-hero">
      <p class="acc-hero-marque">Connaissance Entre Amis Intimes</p>
      ${nom ? `<p class="acc-hero-salut">Bienvenue</p>` : ""}
      <h2 class="acc-hero-titre">${nom ? echapper(nom) : "Bienvenue"}</h2>
      <div class="acc-ornement"><span></span></div>
      <p class="acc-hero-date">${echapper(date)}</p>
      <p class="acc-hero-devise">Engagement · Rigueur · Amitié</p>
    </section>`;
}

// ---------------------------------------------------------
// Tuile de chiffre colorée (cliquable si "aller" est renseigné)
// valeur : texte affiché ; unite : petite unité après la valeur (ex. FCFA)
// compter : nombre à faire "monter" de 0 à sa valeur (facultatif)
// couleur : bleu | vert | violet | terre
// ---------------------------------------------------------
const COULEURS = {
  bleu: ["#173f78", "#2a68b0"],
  vert: ["#0f5a35", "#1f8a58"],
  violet: ["#4d2680", "#7345b0"],
  terre: ["#7d3a21", "#b06a45"],
};

export function tuile({ libelle, valeur, unite = "", note = "", icone: nomIcone, aller = "", compter = null, couleur = "bleu", indice = 0 }) {
  const [c1, c2] = COULEURS[couleur] || COULEURS.bleu;
  const attrCompteur = compter != null ? ` data-compter="${Number(compter)}"` : "";
  return `
    <div class="acc-tuile acc-tuile-couleur" style="--i:${indice}; --c1:${c1}; --c2:${c2}" ${aller ? `data-aller="${aller}" role="link" tabindex="0"` : ""}>
      <span class="acc-tuile-filigrane">${svg(nomIcone, 92)}</span>
      <span class="acc-tuile-icone">${svg(nomIcone, 18)}</span>
      <p class="acc-tuile-libelle">${echapper(libelle)}</p>
      <p class="acc-tuile-valeur"><span${attrCompteur}>${echapper(valeur)}</span>${unite ? ` <small>${echapper(unite)}</small>` : ""}</p>
      ${note ? `<p class="acc-tuile-note">${echapper(note)}</p>` : ""}
    </div>`;
}

// Les nombres montent doucement de 0 à leur valeur (sauf si l'animation est réduite)
export function animerCompteurs(conteneur) {
  const reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduit) return;
  conteneur.querySelectorAll("[data-compter]").forEach((element) => {
    const cible = Number(element.dataset.compter);
    const suffixe = element.dataset.suffixe || "";
    if (!Number.isFinite(cible) || cible <= 0) return;
    const duree = 900;
    const debut = performance.now();
    const pas = (maintenant) => {
      const t = Math.min(1, (maintenant - debut) / duree);
      const progres = 1 - Math.pow(1 - t, 3);
      element.textContent = Math.round(cible * progres).toLocaleString("fr-FR") + suffixe;
      if (t < 1 && element.isConnected) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  });
}

// Silhouettes affichées le temps du chargement
export function squeletteAccueil() {
  return `<div class="acc-tuiles" aria-hidden="true">${[0, 1, 2, 3]
    .map((i) => `<div class="acc-tuile acc-squelette" style="--i:${i}"></div>`)
    .join("")}</div>`;
}

// ---------------------------------------------------------
// Prochain bénéficiaire de la tontine
// ---------------------------------------------------------
export function blocBeneficiaire({ beneficiaires }) {
  const contenu = !beneficiaires.length
    ? `<p class="acc-vide">Aucun cycle de tontine ouvert</p>`
    : beneficiaires
        .map(({ cycle, prochain, total }) => {
          if (!prochain) {
            return `
        <div class="acc-beneficiaire">
          <div class="acc-beneficiaire-texte">
            <p class="acc-beneficiaire-nom">${echapper(cycle.nom)}</p>
            <p class="acc-beneficiaire-detail">Tous les membres ont déjà reçu leur tour</p>
          </div>
        </div>`;
          }
          const nom = prochain.profils?.nom || "—";
          const photo = prochain.profils?.photo_url;
          return `
        <div class="acc-beneficiaire">
          <div class="acc-avatar">${photo ? `<img src="${echapper(photo)}" alt="" />` : echapper(initiale(nom))}</div>
          <div class="acc-beneficiaire-texte">
            <p class="acc-beneficiaire-nom">${echapper(nom)}</p>
            <p class="acc-beneficiaire-detail">${echapper(cycle.nom)} · Position ${prochain.ordre_tour} sur ${total}</p>
            <p class="acc-beneficiaire-detail">${formaterMontant(cycle.montant_mensuel)} par mois</p>
          </div>
        </div>`;
        })
        .join("");

  return `
    <section class="acc-bloc">
      <h3 class="acc-bloc-titre">Prochain bénéficiaire</h3>
      ${contenu}
    </section>`;
}

// ---------------------------------------------------------
// Activités récentes : liste en frise verticale
// ---------------------------------------------------------
export function blocActivites(notifications) {
  const lignes = notifications.length
    ? notifications
        .map((n, i) => {
          const type = TYPES.find(([motif]) => motif.test(n.texte || ""));
          const recente = Date.now() - new Date(n.cree_le).getTime() < UNE_JOURNEE;
          return `
        <div class="acc-chrono-item" style="--i:${i}">
          <span class="acc-chrono-badge">${svg(type ? type[1] : "cloche", 15)}</span>
          <div class="acc-chrono-corps">
            <p class="acc-chrono-texte">${echapper(n.texte)}</p>
            <p class="acc-chrono-date">${tempsRelatif(n.cree_le)}${recente ? ' <span class="acc-nouveau">Nouveau</span>' : ""}</p>
          </div>
        </div>`;
        })
        .join("")
    : `<p class="acc-vide">Aucune activité récente</p>`;

  return `
    <section class="acc-bloc">
      <h3 class="acc-bloc-titre">Activités récentes</h3>
      <div class="acc-chrono">${lignes}</div>
    </section>`;
}

// ---------------------------------------------------------
// Dernières publications (extrait seulement)
// ---------------------------------------------------------
export function blocPublications(publications) {
  const cartes = publications.length
    ? publications
        .map((p, i) => {
          const brut = (p.texte || "").trim();
          const extrait = brut ? (brut.length > 110 ? brut.slice(0, 110).trimEnd() + "…" : brut) : "Publication avec média";
          return `
        <div class="acc-publication" style="--i:${i}" data-aller="publications" data-publication="${p.id}" role="link" tabindex="0">
          <p class="acc-publication-texte">${echapper(extrait)}</p>
          <p class="acc-publication-pied">
            <span>${tempsRelatif(p.cree_le)}</span>
            <span class="acc-publication-lire">Lire la publication</span>
          </p>
        </div>`;
        })
        .join("")
    : `<p class="acc-vide">Aucune publication pour le moment</p>`;

  return `
    <section class="acc-bloc acc-bloc-large">
      <h3 class="acc-bloc-titre">Dernières publications</h3>
      <div class="acc-publications">${cartes}</div>
    </section>`;
  }
