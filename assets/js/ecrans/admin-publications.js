// =========================================================
// CEAI — Écran admin "Gestion des publications"
// =========================================================
import { supabase } from "../supabase-client.js";

function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function ecranAdminPublications(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion des publications</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;
  await rafraichir(conteneur);
}

async function rafraichir(conteneur) {
  const [{ data: publications }, { data: commentaires }] = await Promise.all([
    supabase.from("publications").select("id, texte, cree_le, profils(nom)").order("cree_le", { ascending: false }),
    supabase.from("publication_commentaires").select("id, publication_id, texte, cree_le, profils(nom)").order("cree_le"),
  ]);

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion des publications</h2>
    <hr class="trait-or" />
    <div id="liste-pub-admin"></div>
  `;

  const liste = document.getElementById("liste-pub-admin");

  if (!publications || !publications.length) {
    liste.innerHTML = `<p style="color:var(--texte-secondaire)">Aucune publication pour le moment.</p>`;
    return;
  }

  liste.innerHTML = publications
    .map((p) => {
      const commentairesDePub = (commentaires || []).filter((c) => c.publication_id === p.id);
      return `
      <div class="carte">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
          <div>
            <p style="margin:0; font-weight:500">${p.profils?.nom || "—"}</p>
            <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">${formaterDate(p.cree_le)}</p>
          </div>
          <button data-supprimer-pub="${p.id}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 12px; font-size:12px; white-space:nowrap">
            Supprimer
          </button>
        </div>
        ${p.texte ? `<p style="margin:10px 0 0; white-space:pre-line">${p.texte}</p>` : ""}

        ${
          commentairesDePub.length
            ? `<p style="margin:12px 0 6px; font-size:12px; color:var(--texte-secondaire)">Commentaires (${commentairesDePub.length})</p>` +
              commentairesDePub
                .map(
                  (c) => `
              <div style="display:flex; justify-content:space-between; gap:8px; padding:6px 0; border-top:1px solid var(--bordure)">
                <p style="margin:0; font-size:13px"><strong>${c.profils?.nom || "—"}</strong> : ${c.texte}</p>
                <button data-supprimer-commentaire="${c.id}" style="all:unset; cursor:pointer; color:var(--danger); font-size:12px">✕</button>
              </div>
            `
                )
                .join("")
            : ""
        }
      </div>
    `;
    })
    .join("");

  liste.querySelectorAll("[data-supprimer-pub]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm("Supprimer cette publication et tous ses commentaires ?")) return;
      await supabase.from("publications").delete().eq("id", bouton.dataset.supprimerPub);
      rafraichir(conteneur);
    });
  });

  liste.querySelectorAll("[data-supprimer-commentaire]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase.from("publication_commentaires").delete().eq("id", bouton.dataset.supprimerCommentaire);
      rafraichir(conteneur);
    });
  });
}
