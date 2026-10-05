// =========================================================
// CEAI — Composants visuels des tableaux de bord
// Utilisés par l'Accueil et (ensuite) par le Tableau de bord admin.
// Les styles correspondants sont dans assets/css/moderne.css
// =========================================================

import { supabase } from "../supabase-client.js";

// Icônes en traits fins (aucune dépendance, couleur héritée du texte)
const ICONES = {
  membres:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  cotisation: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
  epargne:
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  tontine:
    '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  pret: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  calendrier: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  alerte:
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  tendance: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
};

export function icone(nom, taille = 20) {
  return `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nom] || ""}</svg>`;
}

// Protège l'affichage des textes venant de la base
export function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formaterMontant(montant) {
  return `${Number(montant || 0).toLocaleString("fr-FR")} FCFA`;
}

// "il y a 5 min", "il y a 3 h", "il y a 2 j", puis la date complète
export function tempsRelatif(dateIso) {
  const secondes = Math.max(0, (Date.now() - new Date(dateIso).getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 7) return `il y a ${jours} j`;
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// couleur : bleu | vert | or | violet | rouge
// aller (facultatif) : route vers laquelle la carte renvoie au clic
export function carteStat({ libelle, valeur, note = "", icone: nomIcone, couleur = "bleu", aller = "" }) {
  return `
    <div class="carte-stat degrade-${couleur}" ${aller ? `data-aller="${aller}" role="link" tabindex="0"` : ""}>
      <span class="carte-stat-filigrane">${icone(nomIcone, 96)}</span>
      <span class="carte-stat-icone">${icone(nomIcone, 18)}</span>
      <div>
        <p class="carte-stat-libelle">${echapper(libelle)}</p>
        <p class="carte-stat-valeur">${valeur}</p>
      </div>
      ${note ? `<p class="carte-stat-note">${echapper(note)}</p>` : ""}
    </div>`;
}

export function grilleStats(cartes) {
  return `<div class="grille-stats">${cartes.join("")}</div>`;
}

// Fait fonctionner les cartes cliquables (attribut data-aller)
export function activerCartesCliquables(conteneur) {
  conteneur.querySelectorAll("[data-aller]").forEach((carte) => {
    const aller = () => window.dispatchEvent(new CustomEvent("ceai:naviguer", { detail: carte.dataset.aller }));
    carte.addEventListener("click", aller);
    carte.addEventListener("keydown", (evenement) => {
      if (evenement.key === "Enter") aller();
    });
  });
}

// Bloc "Activités récentes" : liste de { texte, cree_le }
export function panneauActivites(titre, activites) {
  const lignes = activites.length
    ? activites
        .map(
          (a) => `
      <div class="activite">
        <span class="activite-point"></span>
        <div>
          <p class="activite-texte">${echapper(a.texte)}</p>
          <p class="activite-date">${tempsRelatif(a.cree_le)}</p>
        </div>
      </div>`
        )
        .join("")
    : `<p class="panneau-vide">Aucune activité récente</p>`;

  return `
    <div class="panneau-tableau">
      <p class="panneau-tableau-titre">${echapper(titre)}</p>
      ${lignes}
    </div>`;
}

// ---------------------------------------------------------
// Prochain bénéficiaire de la tontine
// ---------------------------------------------------------
export async function chargerProchainsBeneficiaires() {
  const { data: cycles } = await supabase
    .from("tontine_cycles")
    .select("id, nom, montant_mensuel")
    .eq("statut", "ouvert")
    .order("demarre_le", { ascending: false });

  const liste = cycles || [];
  if (!liste.length) return { cycles: [], beneficiaires: [] };

  const { data: participants } = await supabase
    .from("tontine_participants")
    .select("cycle_id, ordre_tour, a_recu, profils(nom, photo_url)")
    .in("cycle_id", liste.map((c) => c.id))
    .order("ordre_tour");

  const beneficiaires = liste.map((cycle) => {
    const duCycle = (participants || []).filter((p) => p.cycle_id === cycle.id);
    return { cycle, prochain: duCycle.find((p) => !p.a_recu), total: duCycle.length };
  });

  return { cycles: liste, beneficiaires };
}

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

export function panneauBeneficiaire({ beneficiaires }) {
  const contenu = !beneficiaires.length
    ? `<p class="panneau-vide">Aucun cycle de tontine ouvert</p>`
    : beneficiaires
        .map(({ cycle, prochain, total }) => {
          if (!prochain) {
            return `
        <div class="beneficiaire">
          <p class="beneficiaire-nom">${echapper(cycle.nom)}</p>
          <p class="beneficiaire-detail">Tous les membres ont déjà reçu leur tour</p>
        </div>`;
          }
          const nom = prochain.profils?.nom || "—";
          const photo = prochain.profils?.photo_url;
          return `
        <div class="beneficiaire">
          <div class="avatar-initiales">
            ${photo ? `<img src="${echapper(photo)}" alt="" />` : echapper(initiale(nom))}
          </div>
          <p class="beneficiaire-nom">${echapper(nom)}</p>
          <p class="beneficiaire-detail">${echapper(cycle.nom)} · Position ${prochain.ordre_tour} sur ${total}</p>
          <p class="beneficiaire-detail">${formaterMontant(cycle.montant_mensuel)} par mois</p>
        </div>`;
        })
        .join("");

  return `
    <div class="panneau-tableau">
      <p class="panneau-tableau-titre">Prochain bénéficiaire</p>
      ${contenu}
    </div>`;
}

// ---------------------------------------------------------
// Bloc "À traiter" (admin) : lignes { libelle, nombre, aller }
// ---------------------------------------------------------
export function panneauATraiter(lignes) {
  const corps = lignes
    .map(
      (l) => `
    <div class="ligne-traiter" data-aller="${l.aller}" role="link" tabindex="0">
      <span>${echapper(l.libelle)}</span>
      <span class="compteur ${l.nombre > 0 ? "compteur-urgent" : ""}">${l.nombre}</span>
    </div>`
    )
    .join("");

  return `
    <div class="panneau-tableau panneau-large">
      <p class="panneau-tableau-titre">À traiter</p>
      ${corps}
    </div>`;
}

// ---------------------------------------------------------
// Thèmes des sessions de cotisation et des cycles de tontine
// L'admin choisit un thème dans la palette, ou deux couleurs libres
// (enregistrées sous la forme "perso:#rrggbb:#rrggbb").
// ---------------------------------------------------------
export const THEMES_OUVERTURE = {
  emeraude: { libelle: "Émeraude", c1: "#13693f", c2: "#27a367" },
  ocean: { libelle: "Océan", c1: "#1d4f91", c2: "#2f7bd0" },
  or: { libelle: "Or", c1: "#8f6410", c2: "#d4a23c" },
  violet: { libelle: "Violet", c1: "#5b2f93", c2: "#8a58c9" },
  rubis: { libelle: "Rubis", c1: "#9b2c2c", c2: "#d65353" },
  turquoise: { libelle: "Turquoise", c1: "#0f6b73", c2: "#27b0b8" },
  corail: { libelle: "Corail", c1: "#b4472a", c2: "#e8845f" },
  ardoise: { libelle: "Ardoise", c1: "#2f3e4e", c2: "#566b80" },
};
export const THEME_PAR_DEFAUT = "emeraude";
const MOTIF_THEME_PERSO = /^perso:#[0-9a-fA-F]{6}:#[0-9a-fA-F]{6}$/;

export function resoudreTheme(cle) {
  if (THEMES_OUVERTURE[cle]) return THEMES_OUVERTURE[cle];
  if (typeof cle === "string" && MOTIF_THEME_PERSO.test(cle)) {
    const [, c1, c2] = cle.split(":");
    return { libelle: "Libre", c1, c2 };
  }
  return THEMES_OUVERTURE[THEME_PAR_DEFAUT];
}

export function styleTheme(cle) {
  const theme = resoudreTheme(cle);
  return `--c1:${theme.c1}; --c2:${theme.c2};`;
}

const BULLES = '<span class="ouverture-bulle ouverture-bulle-a"></span><span class="ouverture-bulle ouverture-bulle-b"></span>';

// Carte d'une session / d'un cycle, avec fond dégradé légèrement animé.
// attributs : attributs HTML sûrs (ex. data-session="..."), classes : classes CSS en plus
export function carteOuverture({ nom, theme, details = [], badge = "", attributs = "", classes = "" }) {
  return `
    <div class="carte-ouverture ${classes}" style="${styleTheme(theme)}" ${attributs}>
      ${BULLES}
      <div class="ouverture-entete">
        <p class="ouverture-nom">${echapper(nom)}</p>
        ${badge ? `<span class="ouverture-badge">${echapper(badge)}</span>` : ""}
      </div>
      ${details.length ? `<div class="ouverture-details">${details.map((d) => `<p>${echapper(d)}</p>`).join("")}</div>` : ""}
    </div>`;
}

// Rend les cartes cliquables : quandChoisie(valeurDeLAttribut, carte)
export function activerCartesOuverture(conteneur, attribut, quandChoisie) {
  conteneur.querySelectorAll(`[${attribut}]`).forEach((carte) => {
    const choisir = () => quandChoisie(carte.getAttribute(attribut), carte);
    carte.addEventListener("click", choisir);
    carte.addEventListener("keydown", (evenement) => {
      if (evenement.key === "Enter" || evenement.key === " ") {
        evenement.preventDefault();
        choisir();
      }
    });
  });
}

// ---------------------------------------------------------
// Sélecteur de thème (à placer dans un <form>)
// ---------------------------------------------------------
export function selecteurTheme(valeur = THEME_PAR_DEFAUT) {
  const estLibre = typeof valeur === "string" && MOTIF_THEME_PERSO.test(valeur);
  const [, couleur1, couleur2] = estLibre ? valeur.split(":") : [null, "#13693f", "#27a367"];
  const choisi = estLibre ? "libre" : THEMES_OUVERTURE[valeur] ? valeur : THEME_PAR_DEFAUT;

  const pastilles = Object.entries(THEMES_OUVERTURE)
    .map(
      ([cle, t]) => `
    <label class="pastille-theme">
      <input type="radio" name="theme" value="${cle}" ${choisi === cle ? "checked" : ""} />
      <span class="pastille-theme-pastille" style="--c1:${t.c1}; --c2:${t.c2}"></span>
      <em>${t.libelle}</em>
    </label>`
    )
    .join("");

  return `
    <div class="selecteur-theme">
      <p class="selecteur-theme-titre">Thème</p>
      <div class="selecteur-theme-liste">
        ${pastilles}
        <label class="pastille-theme">
          <input type="radio" name="theme" value="libre" ${choisi === "libre" ? "checked" : ""} />
          <span class="pastille-theme-pastille pastille-libre" style="--c1:${couleur1}; --c2:${couleur2}">+</span>
          <em>Libre</em>
        </label>
      </div>
      <div class="selecteur-theme-libre" ${choisi === "libre" ? "" : "hidden"}>
        <label>Couleur 1 <input type="color" name="couleur1" value="${couleur1}" /></label>
        <label>Couleur 2 <input type="color" name="couleur2" value="${couleur2}" /></label>
        <p class="selecteur-theme-aide">Choisissez des couleurs assez foncées pour que le texte reste lisible.</p>
      </div>
      <div class="carte-ouverture apercu-theme" style="${styleTheme(valeur)}">
        ${BULLES}
        <div class="ouverture-entete"><p class="ouverture-nom">Aperçu du thème</p></div>
      </div>
    </div>`;
}

// Lit le thème choisi dans un formulaire contenant selecteurTheme()
export function lireTheme(formulaire) {
  const choix = formulaire.querySelector('input[name="theme"]:checked')?.value || THEME_PAR_DEFAUT;
  if (choix === "libre") {
    const c1 = formulaire.querySelector('input[name="couleur1"]').value.toLowerCase();
    const c2 = formulaire.querySelector('input[name="couleur2"]').value.toLowerCase();
    return `perso:${c1}:${c2}`;
  }
  return THEMES_OUVERTURE[choix] ? choix : THEME_PAR_DEFAUT;
}

// Branche l'aperçu en direct et l'affichage des couleurs libres
export function activerSelecteurTheme(formulaire) {
  const apercu = formulaire.querySelector(".apercu-theme");
  const zoneLibre = formulaire.querySelector(".selecteur-theme-libre");
  const pastilleLibre = formulaire.querySelector(".pastille-libre");

  const mettreAJour = () => {
    const theme = resoudreTheme(lireTheme(formulaire));
    apercu.style.setProperty("--c1", theme.c1);
    apercu.style.setProperty("--c2", theme.c2);
    zoneLibre.hidden = formulaire.querySelector('input[name="theme"]:checked')?.value !== "libre";
    pastilleLibre.style.setProperty("--c1", formulaire.querySelector('input[name="couleur1"]').value);
    pastilleLibre.style.setProperty("--c2", formulaire.querySelector('input[name="couleur2"]').value);
  };

  formulaire.querySelectorAll('input[name="theme"], input[type="color"]').forEach((champ) => {
    champ.addEventListener("input", mettreAJour);
    champ.addEventListener("change", mettreAJour);
  });
  mettreAJour();
}
