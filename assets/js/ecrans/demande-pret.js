// =========================================================
// CEAI — Écran "Demande de prêt" (visible par tous les membres)
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";
import { calculerPenalite } from "../prets-utils.js";

function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function badgeStatut(statut) {
  const libelles = { en_attente: "En attente", acceptee: "Acceptée", refusee: "Refusée" };
  const couleurs = { en_attente: "var(--or-texte)", acceptee: "#4C9A6A", refusee: "var(--danger)" };
  return `<span style="font-size:11px; color:${couleurs[statut]}; border:1px solid currentColor; padding:2px 8px; border-radius:999px">${libelles[statut]}</span>`;
}

export async function ecranDemandePret(conteneur) {
  conteneur.innerHTML = `
    <h2 class="titre-section">Demande de prêt</h2>
    <hr class="trait-or" />
    <div style="display:flex; gap:8px; margin-bottom:16px">
      <button id="onglet-nouvelle" class="bouton" style="background:var(--or); color:#3A2B0E; padding:8px 14px; font-size:13px">Nouvelle demande</button>
      <button id="onglet-mesdemandes" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:8px 14px; font-size:13px">Mes demandes</button>
    </div>
    <div id="contenu-onglet"></div>
  `;

  const zoneOnglet = document.getElementById("contenu-onglet");
  const boutonNouvelle = document.getElementById("onglet-nouvelle");
  const boutonMesDemandes = document.getElementById("onglet-mesdemandes");

  function activerOnglet(actif) {
    boutonNouvelle.style.background = actif === "nouvelle" ? "var(--or)" : "var(--fond-carte-claire)";
    boutonNouvelle.style.color = actif === "nouvelle" ? "#3A2B0E" : "var(--texte)";
    boutonMesDemandes.style.background = actif === "mesdemandes" ? "var(--or)" : "var(--fond-carte-claire)";
    boutonMesDemandes.style.color = actif === "mesdemandes" ? "#3A2B0E" : "var(--texte)";
  }

  boutonNouvelle.addEventListener("click", () => {
    activerOnglet("nouvelle");
    rendreFormulaire();
  });
  boutonMesDemandes.addEventListener("click", () => {
    activerOnglet("mesdemandes");
    rendreMesDemandes();
  });

  function rendreFormulaire() {
    zoneOnglet.innerHTML = `
      <form id="formulaire-pret" class="carte" style="display:flex; flex-direction:column; gap:16px">
        <label class="champ">
          <span>Montant souhaité (FCFA) — minimum 5 000</span>
          <input type="number" name="montant" min="5000" step="1" required />
        </label>
        <label class="champ">
          <span>Motif (facultatif)</span>
          <textarea name="motif" rows="3" style="background:var(--fond); border:1px solid var(--bordure);
                    border-radius:var(--rayon-petit); padding:11px 12px; color:var(--texte); font-family:inherit;
                    font-size:15px; resize:vertical"></textarea>
        </label>
        <label class="champ">
          <span>Durée de remboursement souhaitée (facultatif)</span>
          <input type="text" name="duree_souhaitee" placeholder="ex : 2 mois" />
        </label>
        <p id="erreur-pret" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
        <button type="submit" class="bouton bouton-or">Envoyer la demande</button>
      </form>
    `;

    document.getElementById("formulaire-pret").addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const donnees = new FormData(evenement.target);
      const erreur = document.getElementById("erreur-pret");
      erreur.hidden = true;

      const moiId = await idProfilCourant();
      const { error } = await supabase.from("prets_demandes").insert({
        membre_id: moiId,
        montant: Number(donnees.get("montant")),
        motif: donnees.get("motif")?.trim() || null,
        duree_souhaitee: donnees.get("duree_souhaitee")?.trim() || null,
      });

      if (error) {
        erreur.textContent = "Erreur : " + error.message;
        erreur.hidden = false;
        return;
      }

      notifier("Une nouvelle demande de prêt a été soumise.");
      activerOnglet("mesdemandes");
      rendreMesDemandes();
    });
  }

  async function rendreMesDemandes() {
    zoneOnglet.innerHTML = `<p class="chargement">Chargement…</p>`;
    const moiId = await idProfilCourant();

    const { data: demandes } = await supabase
      .from("prets_demandes")
      .select("id, montant, motif, duree_souhaitee, statut, reponse_admin, cree_le, date_octroi, solde")
      .eq("membre_id", moiId)
      .order("cree_le", { ascending: false });

    if (!demandes || !demandes.length) {
      zoneOnglet.innerHTML = `<p style="color:var(--texte-secondaire)">Vous n'avez encore fait aucune demande.</p>`;
      return;
    }

    const idsActifs = demandes.filter((d) => d.statut === "acceptee" && !d.solde).map((d) => d.id);
    const { data: remboursements } = idsActifs.length
      ? await supabase
          .from("prets_remboursements")
          .select("id, demande_id, montant, date_remboursement, statut")
          .in("demande_id", idsActifs)
          .order("date_remboursement", { ascending: false })
      : { data: [] };

    zoneOnglet.innerHTML = demandes.map((d) => gabaritDemande(d, remboursements || [])).join("");

    zoneOnglet.querySelectorAll("[data-supprimer-demande]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        if (!window.confirm("Supprimer cette demande ?")) return;
        await supabase.from("prets_demandes").delete().eq("id", bouton.dataset.supprimerDemande);
        rendreMesDemandes();
      });
    });

    zoneOnglet.querySelectorAll("[data-supprimer-remb]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        if (!window.confirm("Supprimer ce remboursement ?")) return;
        await supabase.from("prets_remboursements").delete().eq("id", bouton.dataset.supprimerRemb);
        rendreMesDemandes();
      });
    });

    zoneOnglet.querySelectorAll("[data-formulaire-remb]").forEach((formulaire) => {
      formulaire.addEventListener("submit", async (evenement) => {
        evenement.preventDefault();
        const donnees = new FormData(evenement.target);
        const { error } = await supabase.from("prets_remboursements").insert({
          demande_id: formulaire.dataset.formulaireRemb,
          membre_id: moiId,
          montant: Number(donnees.get("montant")),
          date_remboursement: donnees.get("date_remboursement"),
        });
        if (error) {
          alert("Erreur : " + error.message);
          return;
        }
        notifier("Un remboursement de prêt a été déclaré.");
        rendreMesDemandes();
      });
    });
  }

  function gabaritDemande(d, tousLesRemboursements) {
    const estActif = d.statut === "acceptee" && !d.solde;
    const peutSupprimer = d.statut === "en_attente" || d.statut === "refusee";
    const mesRemb = tousLesRemboursements.filter((r) => r.demande_id === d.id);
    const rembValide = mesRemb.filter((r) => r.statut === "valide").reduce((s, r) => s + Number(r.montant), 0);
    const { moisEnRetard, penalite } = estActif ? calculerPenalite(d.montant, d.date_octroi) : { moisEnRetard: 0, penalite: 0 };
    const resteDu = Number(d.montant) + penalite - rembValide;

    return `
      <div class="carte">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
          <div>
            <p style="margin:0; font-weight:500">${Number(d.montant).toLocaleString("fr-FR")} FCFA</p>
            <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">${formaterDate(d.cree_le)}</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px">
            ${d.solde ? `<span style="font-size:11px; color:#4C9A6A; border:1px solid currentColor; padding:2px 8px; border-radius:999px">Soldé</span>` : badgeStatut(d.statut)}
            ${peutSupprimer ? `<button data-supprimer-demande="${d.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>` : ""}
          </div>
        </div>
        ${d.motif ? `<p style="margin:10px 0 0; font-size:13px; color:var(--texte-secondaire)">Motif : ${d.motif}</p>` : ""}
        ${d.duree_souhaitee ? `<p style="margin:4px 0 0; font-size:13px; color:var(--texte-secondaire)">Durée souhaitée : ${d.duree_souhaitee}</p>` : ""}
        ${d.reponse_admin ? `<p style="margin:10px 0 0; font-size:13px; padding-top:10px; border-top:1px solid var(--bordure)">Réponse : ${d.reponse_admin}</p>` : ""}

        ${
          estActif
            ? `
          <div style="display:flex; gap:14px; margin-top:12px; flex-wrap:wrap; padding-top:10px; border-top:1px solid var(--bordure)">
            ${penalite > 0 ? `<div><p style="margin:0; font-size:11px; color:var(--texte-secondaire)">PÉNALITÉ (${moisEnRetard} mois)</p><p style="margin:2px 0 0; color:var(--danger)">${penalite.toLocaleString("fr-FR")} FCFA</p></div>` : ""}
            <div><p style="margin:0; font-size:11px; color:var(--texte-secondaire)">REMBOURSÉ</p><p style="margin:2px 0 0; color:#4C9A6A">${rembValide.toLocaleString("fr-FR")} FCFA</p></div>
            <div><p style="margin:0; font-size:11px; color:var(--texte-secondaire)">RESTE DÛ</p><p style="margin:2px 0 0; font-weight:600">${resteDu.toLocaleString("fr-FR")} FCFA</p></div>
          </div>

          <form data-formulaire-remb="${d.id}" style="display:flex; gap:8px; margin-top:12px">
            <input type="number" name="montant" min="1" placeholder="Montant" required
                   style="flex:1; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
            <input type="date" name="date_remboursement" required value="${new Date().toISOString().slice(0, 10)}"
                   style="background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
            <button type="submit" class="bouton bouton-or" style="padding:8px 14px; font-size:13px">Déclarer</button>
          </form>

          ${
            mesRemb.length
              ? mesRemb
                  .map(
                    (r) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-top:1px solid var(--bordure); margin-top:8px">
                <p style="margin:0; font-size:13px">${Number(r.montant).toLocaleString("fr-FR")} FCFA · ${formaterDate(r.date_remboursement)}</p>
                <div style="display:flex; align-items:center; gap:8px">
                  ${badgeStatut(r.statut === "en_attente" ? "en_attente" : r.statut === "valide" ? "acceptee" : "refusee")}
                  ${r.statut !== "valide" ? `<button data-supprimer-remb="${r.id}" class="bouton-icone" aria-label="Supprimer" style="color:var(--danger)">✕</button>` : ""}
                </div>
              </div>
            `
                  )
                  .join("")
              : ""
          }
        `
            : ""
        }
      </div>
    `;
  }

  rendreFormulaire();
}
