// =========================================================
// CEAI — Écran "Publications"
// Quand on arrive depuis une publication de l'Accueil, l'écran
// défile jusqu'à cette publication et la met brièvement en valeur.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";
import { echapper } from "./composants-tableau.js";

const CLE_CIBLE = "ceai-publication-cible";

const ICONE_COMMENTAIRE =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

// Étoile dessinée (pleine quand on a réagi), à la place d'un caractère texte
function iconeEtoile(pleine) {
  return `<svg viewBox="0 0 24 24" width="17" height="17" fill="${pleine ? "currentColor" : "none"}" stroke="currentColor"
    stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2.5 15 9 22 9.6 16.7 14.3 18.3 21.3 12 17.6 5.7 21.3 7.3 14.3 2 9.6 9 9"/></svg>`;
}

function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

// Défile jusqu'à la publication choisie sur l'Accueil et la met en valeur quelques secondes
function allerALaPublicationCible() {
  let cible = null;
  try {
    cible = sessionStorage.getItem(CLE_CIBLE);
    sessionStorage.removeItem(CLE_CIBLE);
  } catch {
    return;
  }
  if (!cible) return;

  const carte = document.querySelector(`[data-publication-id="${CSS.escape(cible)}"]`);
  if (!carte) return;

  carte.scrollIntoView({ behavior: "smooth", block: "center" });
  carte.style.transition = "box-shadow 0.6s ease";
  carte.style.boxShadow = "0 0 0 3px var(--or-texte)";
  setTimeout(() => {
    carte.style.boxShadow = "";
  }, 2600);
}

export async function ecranPublications(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Publications</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;

  const moiId = await idProfilCourant();

  const { data: monProfil } = await supabase.from("profils").select("role").eq("id", moiId).single();
  const jeSuisAdmin = monProfil?.role === "admin";

  await rafraichirFil(conteneur, moiId, jeSuisAdmin);
  allerALaPublicationCible();
}

async function rafraichirFil(conteneur, moiId, jeSuisAdmin) {
  const [{ data: publications }, { data: medias }, { data: reactions }, { data: commentaires }] = await Promise.all([
    supabase.from("publications").select("id, texte, cree_le, auteur_id, profils(nom)").order("cree_le", { ascending: false }),
    supabase.from("publication_medias").select("publication_id, url, type, ordre").order("ordre"),
    supabase.from("publication_reactions").select("publication_id, membre_id"),
    supabase.from("publication_commentaires").select("id, publication_id, membre_id, texte, cree_le, profils(nom)").order("cree_le"),
  ]);

  conteneur.innerHTML = `
    <h2 class="titre-section">Publications</h2>
    <hr class="trait-or" />
    ${jeSuisAdmin ? gabaritFormulaireCreation() : ""}
    <div id="liste-publications"></div>
  `;

  if (jeSuisAdmin) brancherFormulaireCreation(conteneur, moiId, jeSuisAdmin);

  const listePublications = document.getElementById("liste-publications");
  listePublications.innerHTML = (publications && publications.length)
    ? publications.map((p) => gabaritPublication(p, medias || [], reactions || [], commentaires || [], moiId)).join("")
    : `<p style="color:var(--texte-secondaire)">Aucune publication pour le moment.</p>`;

  brancherInteractions(conteneur, moiId, jeSuisAdmin);
}

function gabaritFormulaireCreation() {
  return `
    <form id="formulaire-publication" class="carte" style="display:flex; flex-direction:column; gap:12px">
      <p style="margin:0; font-weight:500">Nouvelle publication</p>
      <textarea name="texte" rows="3" placeholder="Écrivez quelque chose..."
                style="background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit);
                padding:11px 12px; color:var(--texte); font-family:inherit; font-size:15px; resize:vertical"></textarea>
      <input type="file" name="media" accept="image/*,video/*" />
      <p id="erreur-publication" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
      <button type="submit" class="bouton bouton-or">Publier</button>
    </form>
  `;
}

function brancherFormulaireCreation(conteneur, moiId) {
  document.getElementById("formulaire-publication").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const texte = donnees.get("texte")?.trim();
    const fichier = donnees.get("media");
    const erreur = document.getElementById("erreur-publication");
    erreur.hidden = true;

    if (!texte && (!fichier || !fichier.size)) {
      erreur.textContent = "Ajoutez un texte ou un média.";
      erreur.hidden = false;
      return;
    }

    const { data: publication, error: erreurPub } = await supabase
      .from("publications")
      .insert({ auteur_id: moiId, texte: texte || null })
      .select()
      .single();

    if (erreurPub) {
      erreur.textContent = "La publication a échoué, réessayez.";
      erreur.hidden = false;
      return;
    }

    if (fichier && fichier.size) {
      const chemin = `${publication.id}/${Date.now()}-${fichier.name}`;
      const { error: erreurUpload } = await supabase.storage.from("publications-medias").upload(chemin, fichier);
      if (!erreurUpload) {
        const { data: urlPublique } = supabase.storage.from("publications-medias").getPublicUrl(chemin);
        await supabase.from("publication_medias").insert({
          publication_id: publication.id,
          url: urlPublique.publicUrl,
          type: fichier.type.startsWith("video") ? "video" : "photo",
        });
      }
    }

    ecranPublications(conteneur);
    notifier("Une nouvelle publication a été partagée.");
  });
}

function gabaritPublication(pub, medias, reactions, commentaires, moiId) {
  const mediasDePub = medias.filter((m) => m.publication_id === pub.id);
  const reactionsDePub = reactions.filter((r) => r.publication_id === pub.id);
  const jaiReagi = reactionsDePub.some((r) => r.membre_id === moiId);
  const commentairesDePub = commentaires.filter((c) => c.publication_id === pub.id);

  return `
    <div class="carte" data-publication-id="${pub.id}">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px">
        <div style="width:36px; height:36px; border-radius:50%; background:var(--fond-carte-claire);
             display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--or-texte)">
          ${echapper(initiale(pub.profils?.nom))}
        </div>
        <div>
          <p style="margin:0; font-size:14px; font-weight:500">${echapper(pub.profils?.nom || "—")}</p>
          <p style="margin:0; font-size:11px; color:var(--texte-secondaire)">${formaterDate(pub.cree_le)}</p>
        </div>
      </div>

      ${pub.texte ? `<p style="margin:0 0 10px; white-space:pre-line">${echapper(pub.texte)}</p>` : ""}

      ${mediasDePub
        .map((m) =>
          m.type === "video"
            ? `<video src="${echapper(m.url)}" controls style="width:100%; border-radius:var(--rayon-petit); margin-bottom:10px"></video>`
            : `<img src="${echapper(m.url)}" alt="" style="width:100%; border-radius:var(--rayon-petit); margin-bottom:10px" />`
        )
        .join("")}

      <div style="display:flex; align-items:center; gap:16px; padding-top:8px; border-top:1px solid var(--bordure)">
        <button class="bouton-reaction" data-id="${pub.id}" style="all:unset; cursor:pointer; display:flex; align-items:center; gap:6px;
                color:${jaiReagi ? "var(--or)" : "var(--texte-secondaire)"}; font-size:13px">
          ${iconeEtoile(jaiReagi)} <span>${reactionsDePub.length}</span>
        </button>
        <span style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--texte-secondaire)">
          ${ICONE_COMMENTAIRE} ${commentairesDePub.length}
        </span>
      </div>

      <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px">
        ${commentairesDePub
          .map(
            (c) => `
          <div style="font-size:13px">
            <strong>${echapper(c.profils?.nom || "—")}</strong>
            <span style="color:var(--texte-secondaire)"> · ${formaterDate(c.cree_le)}</span>
            <p style="margin:2px 0 0">${echapper(c.texte)}</p>
          </div>
        `
          )
          .join("")}
      </div>

      <form class="formulaire-commentaire" data-id="${pub.id}" style="display:flex; gap:8px; margin-top:10px">
        <input type="text" name="texte" placeholder="Écrire un commentaire..." required
               style="flex:1; background:var(--fond); border:1px solid var(--bordure); border-radius:999px;
               padding:8px 14px; color:var(--texte); font-family:inherit; font-size:13px" />
        <button type="submit" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:8px 14px">Envoyer</button>
      </form>
    </div>
  `;
}

function brancherInteractions(conteneur, moiId, jeSuisAdmin) {
  conteneur.querySelectorAll(".bouton-reaction").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      const publicationId = bouton.dataset.id;
      const { data: existante } = await supabase
        .from("publication_reactions")
        .select("publication_id")
        .eq("publication_id", publicationId)
        .eq("membre_id", moiId)
        .maybeSingle();

      if (existante) {
        await supabase.from("publication_reactions").delete().eq("publication_id", publicationId).eq("membre_id", moiId);
      } else {
        await supabase.from("publication_reactions").insert({ publication_id: publicationId, membre_id: moiId });
      }
      rafraichirFil(conteneur, moiId, jeSuisAdmin);
    });
  });

  conteneur.querySelectorAll(".formulaire-commentaire").forEach((formulaire) => {
    formulaire.addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const texte = evenement.target.elements.texte.value.trim();
      if (!texte) return;
      await supabase.from("publication_commentaires").insert({
        publication_id: formulaire.dataset.id,
        membre_id: moiId,
        texte,
      });
      rafraichirFil(conteneur, moiId, jeSuisAdmin);
    });
  });
}
