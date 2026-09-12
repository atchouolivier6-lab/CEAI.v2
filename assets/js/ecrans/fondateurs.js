// =========================================================
// CEAI — Écran "Fondateurs"
// =========================================================
import { supabase } from "../supabase-client.js";

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

export async function ecranFondateurs(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Fondateurs</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const [{ data: page }, { data: fondateurs }] = await Promise.all([
    supabase.from("page_fondateurs").select("histoire_ceai, concepteur_nom, concepteur_contact").eq("id", 1).maybeSingle(),
    supabase.from("fondateurs_membres").select("nom, telephone, photo_url").order("ordre"),
  ]);

  const cartesFondateurs = (fondateurs || [])
    .map(
      (f) => `
    <div class="carte" style="text-align:center">
      <div style="width:72px; height:72px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
           display:flex; align-items:center; justify-content:center; margin:0 auto 10px; font-family:var(--police-titre);
           font-size:26px; color:var(--or-texte)">
        ${f.photo_url ? `<img src="${f.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover" />` : initiale(f.nom)}
      </div>
      <p style="margin:0; font-weight:500">${f.nom}</p>
      <p style="margin:4px 0 0; font-size:13px; color:var(--texte-secondaire)">${f.telephone || ""}</p>
    </div>
  `
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Fondateurs</h2>
    <hr class="trait-or" />

    ${
      page?.histoire_ceai
        ? `<div class="carte">
            <p style="margin:0 0 8px; font-family:var(--police-titre); font-size:16px">L'histoire de CEAI</p>
            <p style="margin:0; color:var(--texte-secondaire); line-height:1.7; white-space:pre-line">${page.histoire_ceai}</p>
          </div>`
        : ""
    }

    ${
      fondateurs && fondateurs.length
        ? `<p style="font-family:var(--police-titre); font-size:16px; margin:0 0 10px">Membres fondateurs</p>
           <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:12px; margin-bottom:16px">${cartesFondateurs}</div>`
        : ""
    }

    ${
      page?.concepteur_nom
        ? `<p style="text-align:center; margin-top:24px; font-family:var(--police-titre); font-style:italic; font-size:12px;
              color:var(--texte-secondaire); letter-spacing:0.02em">
            Concepteur : ${page.concepteur_nom}${page.concepteur_contact ? " — " + page.concepteur_contact : ""}
          </p>`
        : ""
    }
  `;
}
