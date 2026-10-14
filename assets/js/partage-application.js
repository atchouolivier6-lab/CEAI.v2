// =========================================================
// CEAI — Partager l'application
// Un lien qui mène directement à l'installation : la personne qui le
// touche voit tout de suite comment installer CEAI sur son téléphone
// ou son ordinateur (fenêtre d'installation, ou mode d'emploi).
// Même logique que les invitations : lien raccourci tant que le site
// est sur GitHub, lien direct sur votre adresse une fois le site hébergé.
// =========================================================
import { ADRESSE_PUBLIQUE } from "./config-site.js";
import { raccourcirLien } from "./lien-court.js";
import { ouvrirFeuilleLien } from "./partage.js";

async function lienApplication() {
  const publique = (ADRESSE_PUBLIQUE || "").trim();
  const base = (publique || window.location.href).split("#")[0];
  const complet = `${base}#installer`;
  if (publique) return { lien: complet, note: "" };

  const court = await raccourcirLien(complet, "ceai_installer");
  return court
    ? { lien: court, note: "" }
    : { lien: complet, note: "Le raccourcisseur de lien est indisponible : le lien complet est utilisé." };
}

export async function partagerApplication() {
  const { lien, note } = await lienApplication();
  ouvrirFeuilleLien({
    titre: "Partager l'application",
    nom: "Installer CEAI",
    aide:
      "La personne qui touche ce lien voit directement comment installer CEAI sur son téléphone ou son ordinateur, " +
      "puis peut créer son compte ou se connecter.",
    intro: "Installez l'application CEAI (Connaissance Entre Amis Intimes) sur votre téléphone ou votre ordinateur.",
    phraseLien: "Touchez ce lien et suivez les instructions",
    sujet: "Installez l'application CEAI",
    lien,
    note,
  });
       }
