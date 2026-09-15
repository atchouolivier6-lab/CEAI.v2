// =========================================================
// CEAI — Écran admin "Service de prêt"
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";

function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function badgeStatut(statut) {
  const libelles = { en_attente: "En attente", acceptee: "Acceptée", refusee: "Refusée" };
  const couleurs = { en_attente: "var(--or-texte)", acceptee: "#4C9A6A", refusee: "var(--danger)" };
  return `<span style="font-size:11px; color:${couleurs[statut]}; border:1px solid currentColor; padding:2px 8px; border-radius:999px">${libelles[statut]}</span>`;
}

export async function ecranAdminPrets(conteneur) {
  conteneur.innerHTML = `
    <h2 class="titre-section">Service de prêt</h2>
    <hr class="trait-or" />
    <div style="display:flex; gap:8px; margin-bottom:16px">
      <button id="onglet-demandes" class="bouton" style="background:var(--or); color:#3A2B0E; padding:8px 14px; font-size:13px">Demandes</button>
      <button id="onglet-calepin" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:8px 14px; font-size:13px">Calepin</button>
    </div>
    <div id="contenu-onglet-admin"></div>
  `;

  const zoneOnglet = document.getElementById("contenu-onglet-admin");
  const boutonDemandes = document.getElementById("onglet-demandes");
  const boutonCalepin = document.getElementById("onglet-calepin");

  function activerOnglet(actif) {
    boutonDemandes.style.background = actif === "demandes" ? "var(--or)" : "var(--fond-carte-claire)";
    boutonDemandes.style.color = actif === "demandes" ? "#3A2B0E" : "var(--texte)";
    boutonCalepin.style.background = actif === "calepin" ? "var(--or)" : "var(--fond-carte-claire)";
    boutonCalepin.style.color = actif === "calepin" ? "#3A2B0E" : "var(--texte)";
  }

  boutonDemandes.addEventListener("click", () => { activerOnglet("demandes"); rendreDemandes(); });
  boutonCalepin.addEventListener("click", () => { activerOnglet("calepin"); rendreCalepin(); });

  async function rendreDemandes() {
    zoneOnglet.innerHTML = `<p class="chargement">Chargement…</p>`;

    const { data: demandes } = await supabase
      .from("prets_demandes")
      .select("id, montant, motif, duree_souhaitee, statut, reponse_admin, cree_le, profils(nom)")
      .order("cree_le", { ascending: false });

    if (!demandes || !demandes.length) {
      zoneOnglet.innerHTML = `<p style="color:var(--texte-secondaire)">Aucune demande de prêt pour le moment.</p>`;
      return;
    }

    zoneOnglet.innerHTML = demandes.map((d) => gabaritDemande(d)).join("");

    zoneOnglet.querySelectorAll("[data-traiter]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        const [demandeId, statut] = bouton.dataset.traiter.split("|");
        const carte = bouton.closest(".carte");
        const reponse = carte.querySelector(".reponse-admin-champ").value.trim();
        const moiId = await idProfilCourant();

        await supabase
          .from("prets_demandes")
          .update({ statut, reponse_admin: reponse || null, traite_par: moiId, traite_le: new Date().toISOString() })
          .eq("id", demandeId);

        notifier(`Une demande de prêt a été ${statut === "acceptee" ? "acceptée" : "refusée"}.`);
        rendreDemandes();
      });
    });
  }

  function gabaritDemande(d) {
    return `
      <div class="carte">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
          <div>
            <p style="margin:0; font-weight:500">${d.profils?.nom || "—"}</p>
            <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">${formaterDate(d.cree_le)}</p>
          </div>
          ${badgeStatut(d.statut)}
        </div>
        <p style="margin:10px 0 0; font-family:var(--police-titre); font-size:20px">${Number(d.montant).toLocaleString("fr-FR")} FCFA</p>
        ${d.motif ? `<p style="margin:6px 0 0; font-size:13px; color:var(--texte-secondaire)">Motif : ${d.motif}</p>` : ""}
        ${d.duree_souhaitee ? `<p style="margin:4px 0 0; font-size:13px; color:var(--texte-secondaire)">Durée souhaitée : ${d.duree_souhaitee}</p>` : ""}

        ${
          d.statut === "en_attente"
            ? `<textarea class="reponse-admin-champ" rows="2" placeholder="Réponse (facultative)..."
                 style="width:100%; margin-top:10px; background:var(--fond); border:1px solid var(--bordure);
                 border-radius:var(--rayon-petit); padding:10px; color:var(--texte); font-family:inherit; font-size:13px; resize:vertical"></textarea>
               <div style="display:flex; gap:8px; margin-top:8px">
                 <button data-traiter="${d.id}|acceptee" class="bouton" style="background:#4C9A6A; color:#fff; padding:8px 14px; font-size:13px">Accepter</button>
                 <button data-traiter="${d.id}|refusee" class="bouton" style="background:var(--danger); color:#fff; padding:8px 14px; font-size:13px">Refuser</button>
               </div>`
            : d.reponse_admin
              ? `<p style="margin:10px 0 0; font-size:13px; padding-top:10px; border-top:1px solid var(--bordure)">Votre réponse : ${d.reponse_admin}</p>`
              : ""
        }
      </div>
    `;
  }

  async function rendreCalepin() {
    zoneOnglet.innerHTML = `<p class="chargement">Chargement…</p>`;

    const { data: notes } = await supabase
      .from("pret_notes")
      .select("id, texte, cree_le, profils(nom)")
      .order("cree_le", { ascending: false });

    zoneOnglet.innerHTML = `
      <form id="formulaire-note-calepin" class="carte" style="display:flex; flex-direction:column; gap:10px">
        <textarea name="texte" rows="3" placeholder="Ajouter une note (remboursement, rappel, observation...)"
                  style="background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit);
                  padding:11px 12px; color:var(--texte); font-family:inherit; font-size:14px; resize:vertical" required></textarea>
        <button type="submit" class="bouton bouton-or" style="align-self:flex-start">Ajouter la note</button>
      </form>
      <div id="liste-notes-calepin" style="margin-top:16px"></div>
    `;

    const listeNotes = document.getElementById("liste-notes-calepin");
    listeNotes.innerHTML = (notes && notes.length)
      ? notes
          .map(
            (n) => `
          <div class="carte" style="display:flex; justify-content:space-between; gap:10px">
            <div>
              <p style="margin:0; font-size:14px; white-space:pre-line">${n.texte}</p>
              <p style="margin:6px 0 0; font-size:11px; color:var(--texte-secondaire)">${n.profils?.nom || "—"} · ${formaterDate(n.cree_le)}</p>
            </div>
            <button data-supprimer-note="${n.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>
          </div>
        `
          )
          .join("")
      : `<p style="color:var(--texte-secondaire)">Aucune note pour le moment.</p>`;

    listeNotes.querySelectorAll("[data-supprimer-note]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        await supabase.from("pret_notes").delete().eq("id", bouton.dataset.supprimerNote);
        rendreCalepin();
      });
    });

    document.getElementById("formulaire-note-calepin").addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const texte = evenement.target.elements.texte.value.trim();
      if (!texte) return;
      const moiId = await idProfilCourant();
      await supabase.from("pret_notes").insert({ texte, cree_par: moiId });
      rendreCalepin();
    });
  }

  rendreDemandes();
}
