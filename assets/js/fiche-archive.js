// =========================================================
// CEAI — Fiche de clôture : affichage, téléchargement PDF et CSV
// =========================================================
import { construireFicheCotisation, construireFicheTontine } from "./fiche-donnees.js";
import { injecterStyleFiche, rendreFicheHtml } from "./fiche-html.js";
import { construirePdf } from "./fiche-pdf.js";
import { genererQr } from "./qr-simple.js";
import { chargerDonneesCotisation, chargerDonneesTontine } from "./fiche-chargement.js";
import { chargerDonneesPret, construireFichePretOctroi, construireFichePretSolde } from "./fiche-pret.js";

// type de fiche -> [chargement des données, construction de la fiche]
const TYPES = {
  cotisation: [chargerDonneesCotisation, construireFicheCotisation],
  tontine: [chargerDonneesTontine, construireFicheTontine],
  "pret-octroi": [chargerDonneesPret, construireFichePretOctroi],
  "pret-solde": [chargerDonneesPret, construireFichePretSolde],
};

const URL_PDF_LIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const LOGO = "assets/icons/icon-192.png";
const STYLE_SECONDAIRE = "background:var(--fond-carte-claire); color:var(--texte)";

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// pdf-lib n'est chargé qu'au premier besoin
let promessePdfLib = null;
function chargerPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!promessePdfLib) {
    promessePdfLib = new Promise((ok, ko) => {
      const script = document.createElement("script");
      script.src = URL_PDF_LIB;
      script.onload = () => ok(window.PDFLib);
      script.onerror = () => {
        promessePdfLib = null;
        ko(new Error("Bibliothèque PDF indisponible (vérifiez la connexion)"));
      };
      document.head.appendChild(script);
    });
  }
  return promessePdfLib;
}

function enregistrer(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Charge les données et construit la fiche (+ code QR de vérification)
export async function preparerFiche(type, id) {
  const lien = `${location.origin}${location.pathname}`;
  const [charger, construire] = TYPES[type];
  const fiche = construire(await charger(id), { lien });
  let qrModules = null;
  try {
    qrModules = genererQr(`${lien}?ref=${fiche.reference}`);
  } catch {
    qrModules = null;
  }
  return { fiche, qrModules };
}

export async function telechargerPdf({ fiche, qrModules }) {
  const PDFLib = await chargerPdfLib();
  let logoPng = null;
  try {
    const reponse = await fetch(LOGO);
    if (reponse.ok) logoPng = new Uint8Array(await reponse.arrayBuffer());
  } catch {
    logoPng = null;
  }
  const octets = await construirePdf(PDFLib, fiche, { logoPng, qrModules });
  enregistrer(new Blob([octets], { type: "application/pdf" }), `${fiche.reference}.pdf`);
}

function telechargerCsv(fiche) {
  const texte = (cellule) => (typeof cellule === "object" && cellule !== null ? cellule.t : cellule);
  const { colonnes, lignes, total } = fiche.tableau;
  const toutes = [colonnes.map((c) => c.titre), ...lignes.map((l) => l.map(texte)), ...(total ? [total.map(texte)] : [])];
  const csv = toutes.map((ligne) => ligne.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  enregistrer(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `${fiche.reference}.csv`);
}

async function avecAttente(bouton, action) {
  const texteInitial = bouton.textContent;
  bouton.disabled = true;
  bouton.textContent = "Préparation…";
  try {
    await action();
  } catch (erreur) {
    alert("Impossible de produire le fichier : " + (erreur.message || erreur));
  }
  bouton.disabled = false;
  bouton.textContent = texteInitial;
}

export async function ouvrirFiche(conteneur, { type, id, nom, retour }) {
  injecterStyleFiche();
  const entete = (titre) => `<h2 class="titre-section">${echapper(titre)}</h2><hr class="trait-or" />`;
  conteneur.innerHTML = entete(nom) + `<p class="chargement">Chargement de la fiche…</p>`;

  let prepare;
  try {
    prepare = await preparerFiche(type, id);
  } catch (erreur) {
    conteneur.innerHTML =
      entete(nom) +
      `<button id="fiche-retour" class="bouton" style="${STYLE_SECONDAIRE}; margin-bottom:12px">← Retour</button>
       <p style="color:var(--danger)">Impossible de charger la fiche pour le moment.</p>`;
    document.getElementById("fiche-retour").addEventListener("click", retour);
    return;
  }

  const { fiche, qrModules } = prepare;
  conteneur.innerHTML =
    entete(fiche.nom) +
    `<div class="fiche-actions">
       <button id="fiche-retour" class="bouton" style="${STYLE_SECONDAIRE}">← Retour</button>
       <button id="fiche-pdf" class="bouton">Télécharger le PDF</button>
       ${fiche.tableau ? `<button id="fiche-csv" class="bouton" style="${STYLE_SECONDAIRE}">Données (CSV)</button>` : ""}
     </div>` +
    rendreFicheHtml(fiche, { qrModules, logoUrl: LOGO });

  document.getElementById("fiche-retour").addEventListener("click", retour);
  const boutonPdf = document.getElementById("fiche-pdf");
  boutonPdf.addEventListener("click", () => avecAttente(boutonPdf, () => telechargerPdf(prepare)));
  document.getElementById("fiche-csv")?.addEventListener("click", () => telechargerCsv(fiche));
}

export { avecAttente };
