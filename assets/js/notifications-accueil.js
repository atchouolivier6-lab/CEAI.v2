// =========================================================
// CEAI — Accueil : activités récentes et publications
// Chaque activité reçoit une icône colorée et légèrement animée
// selon son sujet (versement, tontine, épargne...). Les
// publications s'affichent en cartes sombres, avec seulement un
// court extrait ; un toucher mène à l'espace Publications.
// =========================================================
import { icone, echapper, tempsRelatif } from "./composants-tableau.js";

// Icônes supplémentaires (en plus de celles de composants-tableau.js)
const EXTRA = {
  cloche: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  publication:
    '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  cloture: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};

function svg(nom, taille = 18) {
  if (!EXTRA[nom]) return icone(nom, taille);
  return `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EXTRA[nom]}</svg>`;
}

// Le premier motif qui correspond au texte de la notification décide de l'icône et de la couleur
const TYPES = [
  { motif: /cl[oô]tur/i, icone: "cloture", c1: "#3f5366", c2: "#6f8aa3" },
  { motif: /[ée]pargne|retrait/i, icone: "epargne", c1: "#8f6410", c2: "#d4a23c" },
  { motif: /tontine|cycle|tirage/i, icone: "tontine", c1: "#5b2f93", c2: "#8a58c9" },
  { motif: /cotisation|versement|session|bilan/i, icone: "cotisation", c1: "#13693f", c2: "#27a367" },
  { motif: /pr[êe]t/i, icone: "pret", c1: "#0f6b73", c2: "#27b0b8" },
  { motif: /publi/i, icone: "publication", c1: "#b4472a", c2: "#e8845f" },
  { motif: /message/i, icone: "message", c1: "#1d4f91", c2: "#2f7bd0" },
  { motif: /membre|adh[ée]r|rejoint|inscri/i, icone: "membres", c1: "#1d4f91", c2: "#2f7bd0" },
];
const PAR_DEFAUT = { icone: "cloche", c1: "#2f3e4e", c2: "#566b80" };
const UNE_JOURNEE = 24 * 3600 * 1000;

export function panneauNotifications(notifications) {
  const lignes = notifications.length
    ? notifications
        .map((n, i) => {
          const type = TYPES.find((t) => t.motif.test(n.texte || "")) || PAR_DEFAUT;
          const recente = Date.now() - new Date(n.cree_le).getTime() < UNE_JOURNEE;
          return `
        <div class="notif ${i === 0 ? "notif-premiere" : ""}" style="--i:${i}; --c1:${type.c1}; --c2:${type.c2}">
          <span class="notif-badge">${svg(type.icone)}</span>
          <div class="notif-corps">
            <p class="notif-texte">${echapper(n.texte)}</p>
            <p class="notif-date">${tempsRelatif(n.cree_le)}</p>
          </div>
          ${recente ? `<span class="notif-nouveau">Nouveau</span>` : ""}
        </div>`;
        })
        .join("")
    : `<p class="panneau-vide">Aucune activité récente</p>`;

  return `
    <div class="panneau-tableau panneau-notifs">
      <div class="notifs-entete">
        <p class="panneau-tableau-titre">Activités récentes</p>
        ${notifications.length ? `<span class="notifs-compteur">${notifications.length}</span>` : ""}
      </div>
      ${lignes}
    </div>`;
}

export function panneauPublications(publications) {
  const cartes = publications.length
    ? publications
        .map((p) => {
          const brut = (p.texte || "").trim();
          const extrait = brut ? (brut.length > 110 ? brut.slice(0, 110).trimEnd() + "…" : brut) : "Publication avec média";
          return `
        <div class="publication-carte" data-aller="publications" data-publication="${p.id}" role="link" tabindex="0">
          <span class="publication-icone">${svg("publication", 16)}</span>
          <p class="publication-texte">${echapper(extrait)}</p>
          <p class="publication-pied">
            <span>${tempsRelatif(p.cree_le)}</span>
            <span class="publication-lire">Lire la publication</span>
          </p>
        </div>`;
        })
        .join("")
    : `<p class="panneau-vide">Aucune publication pour le moment</p>`;

  return `
    <div class="panneau-tableau panneau-large panneau-publications">
      <p class="panneau-tableau-titre">Dernières publications</p>
      <div class="publications-liste">${cartes}</div>
    </div>`;
  }
