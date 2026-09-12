// =========================================================
// CEAI — Écran "Annuaire des membres"
// =========================================================
import { supabase } from "../supabase-client.js";

function initiale(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

function avatarHtml(profil, taille) {
  return profil.photo_url
    ? `<img src="${profil.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover" />`
    : `<span style="font-family:var(--police-titre); font-size:${Math.round(taille * 0.4)}px; color:var(--or-texte)">${initiale(profil.nom)}</span>`;
}

export async function ecranAnnuaire(conteneur) {
  conteneur.innerHTML = `
    <h2 class="titre-section">Annuaire des membres</h2>
    <hr class="trait-or" />
    <p class="chargement">Chargement…</p>
  `;

  const { data: membres, error } = await supabase
    .from("profils")
    .select("id, nom, photo_url, role, telephone, bio")
    .order("nom");

  if (error) {
    conteneur.innerHTML = `
      <h2 class="titre-section">Annuaire des membres</h2>
      <hr class="trait-or" />
      <p style="color:var(--danger)">Impossible de charger l'annuaire pour le moment.</p>
    `;
    return;
  }

  rendreGrille(conteneur, membres || []);
}

function rendreGrille(conteneur, membres) {
  const cartes = membres
    .map(
      (m, i) => `
    <button class="carte-membre" data-index="${i}" style="all:unset; cursor:pointer; text-align:center; background:var(--fond-carte);
         border:1px solid var(--bordure); border-radius:var(--rayon); padding:16px 8px; display:flex; flex-direction:column; align-items:center; gap:8px">
      <div style="width:56px; height:56px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
           display:flex; align-items:center; justify-content:center">
        ${avatarHtml(m, 56)}
      </div>
      <p style="margin:0; font-size:13px; font-weight:500; line-height:1.3">${m.nom}</p>
      <span style="font-size:10px; color:var(--or-texte); background:var(--fond-carte-claire); padding:2px 8px;
            border-radius:999px; text-transform:capitalize">${m.role}</span>
    </button>
  `
    )
    .join("");

  conteneur.innerHTML = `
    <h2 class="titre-section">Annuaire des membres</h2>
    <hr class="trait-or" />
    ${
      membres.length
        ? `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:12px">${cartes}</div>`
        : `<p style="color:var(--texte-secondaire)">Aucun membre pour le moment.</p>`
    }
  `;

  conteneur.querySelectorAll(".carte-membre").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      rendreDetail(conteneur, membres[Number(bouton.dataset.index)], membres);
    });
  });
}

function rendreDetail(conteneur, membre, tousLesMembres) {
  conteneur.innerHTML = `
    <button id="bouton-retour-annuaire" class="lien" style="margin-bottom:16px">← Retour à l'annuaire</button>
    <div class="carte" style="text-align:center">
      <div style="width:88px; height:88px; border-radius:50%; background:var(--fond-carte-claire); overflow:hidden;
           display:flex; align-items:center; justify-content:center; margin:0 auto 12px">
        ${avatarHtml(membre, 88)}
      </div>
      <p style="font-family:var(--police-titre); font-size:18px; margin:0">${membre.nom}</p>
      <span style="display:inline-block; margin-top:8px; background:var(--fond-carte-claire); color:var(--or-texte);
            font-size:11px; padding:3px 10px; border-radius:999px; text-transform:capitalize">${membre.role}</span>
    </div>
    <div class="carte">
      <p style="color:var(--texte-secondaire); font-size:12px; margin:0">TÉLÉPHONE</p>
      <p style="margin:2px 0 12px">${membre.telephone || "—"}</p>
      <p style="color:var(--texte-secondaire); font-size:12px; margin:0">BIO</p>
      <p style="margin:2px 0 0">${membre.bio || "—"}</p>
    </div>
  `;

  document.getElementById("bouton-retour-annuaire").addEventListener("click", () => {
    rendreGrille(conteneur, tousLesMembres);
  });
               }
