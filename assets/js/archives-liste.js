// =========================================================
// CEAI — Liste d'archives commune (sessions de cotisation / cycles de tontine)
// Recherche, regroupement par année, fiche, PDF, suppression (admin).
// =========================================================
import { supabase } from "./supabase-client.js";
import { idProfilCourant } from "./mon-profil.js";
import { ouvrirFiche, preparerFiche, telechargerPdf, avecAttente } from "./fiche-archive.js";

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

async function jeSuisAdmin() {
  const moiId = await idProfilCourant();
  const { data } = await supabase.from("profils").select("role").eq("id", moiId).single();
  return data?.role === "admin";
}

export async function afficherArchives(conteneur, cfg) {
  const entete = `<h2 class="titre-section">${cfg.titre}</h2><hr class="trait-or" />`;
  conteneur.innerHTML = entete + `<p class="chargement">Chargement…</p>`;

  const [{ data, error }, estAdmin] = await Promise.all([
    supabase.from(cfg.table).select(`id, nom, ${cfg.debut}, ${cfg.fin}`).eq("statut", cfg.statut).order(cfg.fin, { ascending: false }),
    jeSuisAdmin(),
  ]);

  if (error) {
    conteneur.innerHTML = entete + `<p style="color:var(--danger)">Impossible de charger les archives pour le moment.</p>`;
    return;
  }

  const elements = data || [];
  const anneeDe = (e) => (e[cfg.fin] ? String(new Date(e[cfg.fin]).getFullYear()) : "Sans date");

  conteneur.innerHTML =
    entete +
    (elements.length
      ? `<input id="recherche-archives" type="search" placeholder="Rechercher par nom ou par année"
           style="width:100%; box-sizing:border-box; padding:10px 12px; margin-bottom:6px; font-size:14px; border-radius:8px; border:1px solid var(--bordure); background:var(--fond-carte); color:var(--texte)" />`
      : "") +
    `<div id="liste-archives"></div>`;

  const liste = conteneur.querySelector("#liste-archives");

  const dessiner = (filtre = "") => {
    const terme = filtre.trim().toLowerCase();
    const visibles = elements.filter((e) => !terme || e.nom.toLowerCase().includes(terme) || anneeDe(e).includes(terme));
    if (!visibles.length) {
      liste.innerHTML = `<p style="color:var(--texte-secondaire)">${elements.length ? "Aucun résultat." : cfg.vide}</p>`;
      return;
    }
    let anneeCourante = "";
    liste.innerHTML = visibles
      .map((e) => {
        const annee = anneeDe(e);
        const titreAnnee =
          annee !== anneeCourante
            ? `<p style="margin:16px 0 6px; font-size:12px; letter-spacing:1px; color:var(--or-texte)">${annee}</p>`
            : "";
        anneeCourante = annee;
        return `${titreAnnee}
        <div class="carte">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px">
            <div>
              <p style="margin:0; font-weight:500">${echapper(e.nom)}</p>
              <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
                ${cfg.libelleDebut} ${formaterDate(e[cfg.debut])} · ${cfg.libelleFin} ${formaterDate(e[cfg.fin])}
              </p>
            </div>
            ${estAdmin ? `<button data-supprimer="${e.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>` : ""}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px">
            <button class="bouton" data-fiche="${e.id}">Voir la fiche</button>
            <button class="bouton" data-pdf="${e.id}" style="background:var(--fond-carte-claire); color:var(--texte)">Télécharger le PDF</button>
          </div>
        </div>`;
      })
      .join("");
  };

  dessiner();
  conteneur.querySelector("#recherche-archives")?.addEventListener("input", (evt) => dessiner(evt.target.value));

  liste.addEventListener("click", async (evt) => {
    const bouton = evt.target.closest("button");
    if (!bouton) return;
    const trouve = (id) => elements.find((e) => e.id === id);

    if (bouton.dataset.fiche) {
      const e = trouve(bouton.dataset.fiche);
      ouvrirFiche(conteneur, { type: cfg.type, id: e.id, nom: e.nom, retour: () => afficherArchives(conteneur, cfg) });
    } else if (bouton.dataset.pdf) {
      await avecAttente(bouton, async () => telechargerPdf(await preparerFiche(cfg.type, bouton.dataset.pdf)));
    } else if (bouton.dataset.supprimer) {
      const e = trouve(bouton.dataset.supprimer);
      if (!window.confirm(`Supprimer définitivement ${cfg.article} "${e.nom}" des archives ? Cette action est irréversible.`)) return;
      const { error: erreurSuppression } = await supabase.from(cfg.table).delete().eq("id", e.id);
      if (erreurSuppression) {
        alert("Erreur : " + erreurSuppression.message);
        return;
      }
      afficherArchives(conteneur, cfg);
    }
  });
}
