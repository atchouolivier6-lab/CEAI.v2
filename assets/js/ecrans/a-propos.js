// =========================================================
// CEAI — Écran "À propos"
// =========================================================
import { supabase } from "../supabase-client.js";

export async function ecranAPropos(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">À propos</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const { data: sections, error } = await supabase
    .from("page_a_propos_sections")
    .select("titre, contenu")
    .order("ordre");

  if (error || !sections || !sections.length) {
    conteneur.innerHTML = `
      <h2 class="titre-section">À propos</h2>
      <hr class="trait-or" />
      <p style="color:var(--texte-secondaire)">Le contenu de cette page n'a pas encore été renseigné.</p>
    `;
    return;
  }

  const accordeon = sections
    .map(
      (s, i) => `
    <details class="carte" style="padding:0" ${i === 0 ? "open" : ""}>
      <summary style="padding:16px 18px; cursor:pointer; font-weight:500; list-style:none; display:flex;
               justify-content:space-between; align-items:center">
        ${s.titre}
        <span style="color:var(--texte-secondaire); font-size:12px">▾</span>
      </summary>
      <p style="padding:0 18px 16px; margin:0; color:var(--texte-secondaire); line-height:1.6; white-space:pre-line">${s.contenu}</p>
    </details>
  `
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">À propos</h2>
    <hr class="trait-or" />
    ${accordeon}
  `;
}
