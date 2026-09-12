// =========================================================
// CEAI — Écran "Mon profil"
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formaterMembreDepuis(dateIso) {
  const date = new Date(dateIso);
  return `Membre depuis ${MOIS[date.getMonth()]} ${date.getFullYear()}`;
}

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

export async function ecranMonProfil(conteneur) {
  const utilisateurId = await idProfilCourant();

  conteneur.innerHTML = '<p class="chargement">Chargement…</p>';

  const { data: profil, error } = await supabase
    .from("profils")
    .select("nom, email, telephone, bio, photo_url, role, cree_le")
    .eq("id", utilisateurId)
    .single();

  if (error || !profil) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Mon profil</h2>
      <hr class="trait-or" />
      <p style="color:var(--danger)">Impossible de charger votre profil pour le moment.</p>
    `;
    return;
  }

  rendreLecture(conteneur, profil, utilisateurId);
}

function rendreLecture(conteneur, profil, utilisateurId) {
  conteneur.innerHTML = `
    <h2 class="titre-section">Espace Membres</h2>
    <hr class="trait-or" />

    <div class="carte" style="text-align:center">
      <div style="position:relative; width:88px; height:88px; margin:0 auto 12px">
        <div id="avatar-rond" style="width:88px; height:88px; border-radius:50%; background:var(--fond-carte-claire);
             display:flex; align-items:center; justify-content:center; font-family:var(--police-titre);
             font-size:32px; color:var(--or-texte); overflow:hidden">
          ${profil.photo_url ? `<img src="${profil.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover" />` : initiale(profil.nom)}
        </div>
        <button id="bouton-changer-photo" class="bouton-icone" aria-label="Changer la photo de profil"
                style="position:absolute; bottom:-4px; right:-4px; background:var(--or); color:#3A2B0E; border-radius:50%; padding:6px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>
          </svg>
        </button>
        <input type="file" id="entree-photo" accept="image/*" hidden />
      </div>
      <p style="font-family:var(--police-titre); font-size:18px; margin:0">${profil.nom}</p>
      <p style="color:var(--texte-secondaire); font-size:13px; margin:4px 0 10px">${profil.email}</p>
      <span style="display:inline-block; background:var(--fond-carte-claire); color:var(--or-texte);
             font-size:11px; padding:3px 10px; border-radius:999px; text-transform:capitalize">${profil.role}</span>
      <p style="color:var(--texte-secondaire); font-size:12px; margin-top:14px">${formaterMembreDepuis(profil.cree_le)}</p>
      <p id="erreur-photo" style="color:var(--danger); font-size:12px; margin-top:8px" hidden></p>
    </div>

    <div class="carte">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
        <p style="margin:0; font-weight:500">Informations</p>
        <button id="bouton-modifier" class="lien">Modifier</button>
      </div>
      <p style="color:var(--texte-secondaire); font-size:12px; margin:0">EMAIL</p>
      <p style="margin:2px 0 12px">${profil.email}</p>
      <p style="color:var(--texte-secondaire); font-size:12px; margin:0">TÉLÉPHONE</p>
      <p style="margin:2px 0 12px">${profil.telephone || "—"}</p>
      <p style="color:var(--texte-secondaire); font-size:12px; margin:0">BIO</p>
      <p style="margin:2px 0 0">${profil.bio || "—"}</p>
    </div>
  `;

  document.getElementById("bouton-modifier").addEventListener("click", () => {
    rendreEdition(conteneur, profil, utilisateurId);
  });

  document.getElementById("bouton-changer-photo").addEventListener("click", () => {
    document.getElementById("entree-photo").click();
  });

  document.getElementById("entree-photo").addEventListener("change", async (evenement) => {
    const fichier = evenement.target.files[0];
    if (!fichier) return;
    await televerserPhoto(fichier, utilisateurId, conteneur);
  });
}

async function televerserPhoto(fichier, utilisateurId, conteneur) {
  const erreurPhoto = document.getElementById("erreur-photo");
  erreurPhoto.hidden = true;

  const cheminFichier = `${utilisateurId}/${Date.now()}-${fichier.name}`;

  const { error: erreurUpload } = await supabase.storage
    .from("photos-profil")
    .upload(cheminFichier, fichier, { upsert: true });

  if (erreurUpload) {
    erreurPhoto.textContent = "Le téléversement de la photo a échoué.";
    erreurPhoto.hidden = false;
    return;
  }

  const { data: urlPublique } = supabase.storage.from("photos-profil").getPublicUrl(cheminFichier);

  const { error: erreurMaj } = await supabase
    .from("profils")
    .update({ photo_url: urlPublique.publicUrl })
    .eq("id", utilisateurId);

  if (erreurMaj) {
    erreurPhoto.textContent = "La photo a été envoyée mais n'a pas pu être enregistrée.";
    erreurPhoto.hidden = false;
    return;
  }

  ecranMonProfil(conteneur);
}

function rendreEdition(conteneur, profil, utilisateurId) {
  conteneur.innerHTML = `
    <h2 class="titre-section">Modifier mon profil</h2>
    <hr class="trait-or" />
    <form id="formulaire-profil" class="carte" style="display:flex; flex-direction:column; gap:16px">
      <label class="champ">
        <span>Téléphone</span>
        <input type="tel" name="telephone" value="${profil.telephone || ""}" />
      </label>
      <label class="champ">
        <span>Bio</span>
        <textarea name="bio" rows="4" style="background:var(--fond); border:1px solid var(--bordure);
                  border-radius:var(--rayon-petit); padding:11px 12px; color:var(--texte); font-family:inherit;
                  font-size:15px; resize:vertical">${profil.bio || ""}</textarea>
      </label>
      <p id="erreur-profil" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
      <div style="display:flex; gap:10px">
        <button type="submit" class="bouton bouton-or">Enregistrer</button>
        <button type="button" id="bouton-annuler" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte)">Annuler</button>
      </div>
    </form>
  `;

  document.getElementById("bouton-annuler").addEventListener("click", () => {
    rendreLecture(conteneur, profil, utilisateurId);
  });

  document.getElementById("formulaire-profil").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const donnees = new FormData(evenement.target);
    const erreurProfil = document.getElementById("erreur-profil");

    const { error } = await supabase
      .from("profils")
      .update({
        telephone: donnees.get("telephone") || null,
        bio: donnees.get("bio") || null,
      })
      .eq("id", utilisateurId);

    if (error) {
      erreurProfil.textContent = "L'enregistrement a échoué, réessayez.";
      erreurProfil.hidden = false;
      return;
    }

    ecranMonProfil(conteneur);
  });
}
