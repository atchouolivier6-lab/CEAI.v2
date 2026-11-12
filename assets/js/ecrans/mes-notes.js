// =========================================================
// CEAI — Écran "Mes notes" (bloc-notes personnel et privé)
// Réservé aux membres actifs, agents compris. Chaque personne ne voit
// que ses propres notes (règles d'accès : notes-perso.sql).
// Enregistrement automatique pendant la saisie.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";

const DELAI_AUTO = 1200;
const ENTETE = `<h2 class="titre-section">Mes notes</h2><hr class="trait-or" />`;
const CHAMP =
  "background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:11px 12px; color:var(--texte); font-family:inherit; font-size:15px; box-sizing:border-box";
const SECONDAIRE = "background:var(--fond-carte-claire); color:var(--texte)";

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function extrait(texte, max = 110) {
  const brut = (texte || "").replace(/\s+/g, " ").trim();
  return brut.length > max ? brut.slice(0, max).trimEnd() + "…" : brut;
}

async function membreActif() {
  const moiId = await idProfilCourant();
  const { data } = await supabase.from("profils").select("actif").eq("id", moiId).single();
  return data?.actif !== false;
}

export async function ecranMesNotes(conteneur) {
  conteneur.innerHTML = ENTETE + `<p class="chargement">Chargement…</p>`;
  if (!(await membreActif())) {
    conteneur.innerHTML = ENTETE + `<p style="color:var(--texte-secondaire)">Le bloc-notes est réservé aux membres actifs.</p>`;
    return;
  }
  afficherListe(conteneur);
}

// ---------------------------------------------------------
// Liste des notes
// ---------------------------------------------------------
async function afficherListe(conteneur) {
  conteneur.innerHTML = ENTETE + `<p class="chargement">Chargement…</p>`;

  const { data, error } = await supabase
    .from("notes_perso")
    .select("id, titre, contenu, epingle, modifie_le")
    .order("epingle", { ascending: false })
    .order("modifie_le", { ascending: false });

  if (error) {
    conteneur.innerHTML = ENTETE + `<p style="color:var(--danger)">Impossible de charger vos notes pour le moment.</p>`;
    return;
  }

  const notes = data || [];
  conteneur.innerHTML =
    ENTETE +
    `<p style="margin:0 0 12px; font-size:12px; color:var(--texte-secondaire)">Vos notes sont privées : vous seul pouvez les lire.</p>
     <div style="display:flex; gap:8px; margin-bottom:12px">
       <input id="recherche-notes" type="search" placeholder="Rechercher" style="${CHAMP}; flex:1; min-width:0" />
       <button id="nouvelle-note" class="bouton bouton-or" style="white-space:nowrap">Nouvelle note</button>
     </div>
     <div id="liste-notes"></div>`;

  const liste = conteneur.querySelector("#liste-notes");

  const dessiner = (filtre = "") => {
    const terme = filtre.trim().toLowerCase();
    const visibles = notes.filter((n) => !terme || `${n.titre} ${n.contenu}`.toLowerCase().includes(terme));
    if (!visibles.length) {
      liste.innerHTML = `<p style="color:var(--texte-secondaire)">${
        notes.length ? "Aucun résultat." : "Aucune note pour le moment. Touchez « Nouvelle note » pour commencer."
      }</p>`;
      return;
    }
    liste.innerHTML = visibles
      .map(
        (n) => `
      <div class="carte" data-note="${n.id}" role="button" tabindex="0" style="cursor:pointer">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px">
          <p style="margin:0; font-weight:500">${echapper(n.titre) || "Sans titre"}</p>
          ${n.epingle ? `<span style="font-size:11px; color:var(--or-texte); border:1px solid currentColor; padding:2px 8px; border-radius:999px; white-space:nowrap">Épinglée</span>` : ""}
        </div>
        ${n.contenu ? `<p style="margin:6px 0 0; font-size:13px; color:var(--texte-secondaire)">${echapper(extrait(n.contenu))}</p>` : ""}
        <p style="margin:8px 0 0; font-size:11px; color:var(--texte-secondaire)">${formaterDate(n.modifie_le)}</p>
      </div>`
      )
      .join("");
  };

  dessiner();
  conteneur.querySelector("#recherche-notes").addEventListener("input", (evt) => dessiner(evt.target.value));
  conteneur.querySelector("#nouvelle-note").addEventListener("click", () => ouvrirEditeur(conteneur, null));

  const ouvrir = (cible) => {
    const carte = cible.closest("[data-note]");
    if (carte) ouvrirEditeur(conteneur, notes.find((n) => n.id === carte.dataset.note));
  };
  liste.addEventListener("click", (evt) => ouvrir(evt.target));
  liste.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") ouvrir(evt.target);
  });
}

// ---------------------------------------------------------
// Éditeur d'une note (création ou modification)
// ---------------------------------------------------------
function ouvrirEditeur(conteneur, note) {
  let id = note?.id || null;
  let epingle = Boolean(note?.epingle);
  let supprimee = false;
  let minuteur = null;
  let chaine = Promise.resolve();

  conteneur.innerHTML =
    ENTETE +
    `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px">
       <button id="note-retour" class="bouton" style="${SECONDAIRE}">← Mes notes</button>
       <span id="etat-note" style="font-size:12px; color:var(--texte-secondaire)"></span>
     </div>
     <input id="note-titre" type="text" maxlength="120" placeholder="Titre" style="${CHAMP}; width:100%; margin-bottom:10px; font-weight:500" />
     <textarea id="note-contenu" rows="14" maxlength="10000" placeholder="Écrivez votre note ici…" style="${CHAMP}; width:100%; resize:vertical; min-height:45vh"></textarea>
     <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px">
       <button id="note-epingle" class="bouton" style="${SECONDAIRE}"></button>
       <button id="note-supprimer" class="bouton" style="${SECONDAIRE}; color:var(--danger)">Supprimer</button>
     </div>`;

  const titre = conteneur.querySelector("#note-titre");
  const contenu = conteneur.querySelector("#note-contenu");
  const etat = conteneur.querySelector("#etat-note");
  const boutonEpingle = conteneur.querySelector("#note-epingle");
  titre.value = note?.titre || "";
  contenu.value = note?.contenu || "";
  const libelleEpingle = () => (boutonEpingle.textContent = epingle ? "Désépingler" : "Épingler en haut");
  libelleEpingle();

  const dire = (texte, erreur = false) => {
    if (!etat.isConnected) return;
    etat.textContent = texte;
    etat.style.color = erreur ? "var(--danger)" : "var(--texte-secondaire)";
  };

  const sauver = async () => {
    if (supprimee) return;
    const valeurs = { titre: titre.value.trim(), contenu: contenu.value, epingle };
    if (!id && !valeurs.titre && !valeurs.contenu.trim()) return;
    dire("Enregistrement…");
    try {
      if (id) {
        const { error } = await supabase.from("notes_perso").update(valeurs).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("notes_perso").insert(valeurs).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      dire("Enregistré");
    } catch {
      dire("Échec de l'enregistrement", true);
    }
  };

  // Les enregistrements se font l'un après l'autre : jamais deux créations en double
  const vider = () => {
    clearTimeout(minuteur);
    chaine = chaine.then(sauver);
    return chaine;
  };
  const planifier = () => {
    clearTimeout(minuteur);
    dire("Modifications non enregistrées");
    minuteur = setTimeout(vider, DELAI_AUTO);
  };

  const auMasquage = () => {
    if (!titre.isConnected) {
      document.removeEventListener("visibilitychange", auMasquage);
      return;
    }
    if (document.hidden) vider();
  };
  document.addEventListener("visibilitychange", auMasquage);

  titre.addEventListener("input", planifier);
  contenu.addEventListener("input", planifier);

  boutonEpingle.addEventListener("click", () => {
    epingle = !epingle;
    libelleEpingle();
    vider();
  });

  conteneur.querySelector("#note-retour").addEventListener("click", async () => {
    await vider();
    document.removeEventListener("visibilitychange", auMasquage);
    afficherListe(conteneur);
  });

  conteneur.querySelector("#note-supprimer").addEventListener("click", async () => {
    if (id && !window.confirm("Supprimer cette note ? Cette action est irréversible.")) return;
    supprimee = true;
    clearTimeout(minuteur);
    await chaine;
    if (id) {
      const { error } = await supabase.from("notes_perso").delete().eq("id", id);
      if (error) {
        supprimee = false;
        alert("Erreur : " + error.message);
        return;
      }
    }
    document.removeEventListener("visibilitychange", auMasquage);
    afficherListe(conteneur);
  });

  if (!id) titre.focus();
                                                          }
