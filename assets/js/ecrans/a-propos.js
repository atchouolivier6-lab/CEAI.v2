// =========================================================
// CEAI — Écran "À propos"
// Trois onglets :
//   1. Info complémentaire : les sections de page_a_propos_sections
//   2. FAQ : questions fréquentes (a-propos-faq.js)
//   3. Fondateurs : l'écran des fondateurs (ancienne entrée du menu)
// =========================================================
import { supabase } from "../supabase-client.js";
import { ecranFondateurs } from "./fondateurs.js";
import { afficherFaq } from "./a-propos-faq.js";

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function afficherInfoComplementaire(zone) {
  const { data: sections, error } = await supabase
    .from("page_a_propos_sections")
    .select("titre, contenu")
    .order("ordre");

  if (error || !sections || !sections.length) {
    zone.innerHTML = `<p style="color:var(--texte-secondaire)">Le contenu de cette page n'a pas encore été renseigné.</p>`;
    return;
  }

  zone.innerHTML = sections
    .map(
      (s, i) => `
    <details class="carte" style="padding:0" ${i === 0 ? "open" : ""}>
      <summary style="padding:16px 18px; cursor:pointer; font-weight:500; list-style:none; display:flex;
               justify-content:space-between; align-items:center">
        ${echapper(s.titre)}
        <span style="color:var(--texte-secondaire); font-size:12px">▾</span>
      </summary>
      <p style="padding:0 18px 16px; margin:0; color:var(--texte-secondaire); line-height:1.6; white-space:pre-line">${echapper(s.contenu)}</p>
    </details>
  `
    )
    .join("");
}

async function afficherFondateurs(zone) {
  await ecranFondateurs(zone);
  // L'écran des fondateurs affiche son propre titre : on l'enlève,
  // car le titre "À propos" est déjà en haut de la page.
  zone.querySelector(".titre-section")?.remove();
  zone.querySelector(".trait-or")?.remove();
}

export async function ecranAPropos(conteneur) {
  conteneur.innerHTML = `
    <h2 class="titre-section">À propos</h2>
    <hr class="trait-or" />
    <div class="onglets" role="tablist">
      <button class="onglet actif" data-onglet="infos" role="tab" aria-selected="true">Info complémentaire</button>
      <button class="onglet" data-onglet="faq" role="tab" aria-selected="false">FAQ</button>
      <button class="onglet" data-onglet="fondateurs" role="tab" aria-selected="false">Fondateurs</button>
    </div>
    <div id="zone-a-propos"></div>
  `;

  const zone = document.getElementById("zone-a-propos");
  const onglets = conteneur.querySelectorAll(".onglet");
  const affichages = { infos: afficherInfoComplementaire, faq: afficherFaq, fondateurs: afficherFondateurs };

  async function ouvrirOnglet(cle) {
    onglets.forEach((onglet) => {
      const actif = onglet.dataset.onglet === cle;
      onglet.classList.toggle("actif", actif);
      onglet.setAttribute("aria-selected", String(actif));
    });
    zone.innerHTML = `<p class="chargement">Chargement…</p>`;
    await affichages[cle](zone);
  }

  onglets.forEach((onglet) => {
    onglet.addEventListener("click", () => ouvrirOnglet(onglet.dataset.onglet));
  });

  await ouvrirOnglet("infos");
                      }
