// =========================================================
// CEAI — Écran admin "Service de prêt"
// Accès : admin ET comptable peuvent traiter les demandes
// (accepter/refuser). Seul l'admin peut supprimer
// définitivement une demande refusée des archives.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";
import { calculerPenalite } from "../prets-utils.js";

function formaterDate(dateIso) {
  return new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function badgeStatut(statut) {
  const libelles = { en_attente: "En attente", acceptee: "Acceptée", refusee: "Refusée" };
  const couleurs = { en_attente: "var(--or-texte)", acceptee: "#4C9A6A", refusee: "var(--danger)" };
  return `<span style="font-size:11px; color:${couleurs[statut]}; border:1px solid currentColor; padding:2px 8px; border-radius:999px">${libelles[statut]}</span>`;
}

async function obtenirRole() {
  const moiId = await idProfilCourant();
  const { data } = await supabase.from("profils").select("role").eq("id", moiId).single();
  return data?.role || "membre";
}

export async function ecranAdminPrets(conteneur) {
  conteneur.innerHTML = `
    <h2 class="titre-section">Service de prêt</h2>
    <hr class="trait-or" />
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap">
      <button id="onglet-demandes" class="bouton" style="background:var(--or); color:#3A2B0E; padding:8px 14px; font-size:13px">Demandes</button>
      <button id="onglet-en-cours" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:8px 14px; font-size:13px">Prêts en cours</button>
      <button id="onglet-calepin" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:8px 14px; font-size:13px">Calepin</button>
    </div>
    <div id="contenu-onglet-admin"></div>
  `;

  const zoneOnglet = document.getElementById("contenu-onglet-admin");
  const boutonDemandes = document.getElementById("onglet-demandes");
  const boutonEnCours = document.getElementById("onglet-en-cours");
  const boutonCalepin = document.getElementById("onglet-calepin");

  function activerOnglet(actif) {
    const boutons = { demandes: boutonDemandes, "en-cours": boutonEnCours, calepin: boutonCalepin };
    Object.entries(boutons).forEach(([cle, bouton]) => {
      bouton.style.background = cle === actif ? "var(--or)" : "var(--fond-carte-claire)";
      bouton.style.color = cle === actif ? "#3A2B0E" : "var(--texte)";
    });
  }

  boutonDemandes.addEventListener("click", () => { activerOnglet("demandes"); rendreDemandes(); });
  boutonEnCours.addEventListener("click", () => { activerOnglet("en-cours"); rendrePretsEnCours(); });
  boutonCalepin.addEventListener("click", () => { activerOnglet("calepin"); rendreCalepin(); });

  async function rendreDemandes() {
    zoneOnglet.innerHTML = `<p class="chargement">Chargement…</p>`;
    const role = await obtenirRole();
    const estAdmin = role === "admin";

    const { data: demandes, error } = await supabase
      .from("prets_demandes")
      .select("id, montant, motif, duree_souhaitee, statut, reponse_admin, cree_le, profils!prets_demandes_membre_id_fkey(nom)")
      .order("cree_le", { ascending: false });

    if (error) {
      zoneOnglet.innerHTML = `<p style="color:var(--danger)">Erreur : ${error.message}</p>`;
      return;
    }

    if (!demandes || !demandes.length) {
      zoneOnglet.innerHTML = `<p style="color:var(--texte-secondaire)">Aucune demande de prêt pour le moment.</p>`;
      return;
    }

    zoneOnglet.innerHTML = demandes.map((d) => gabaritDemande(d, estAdmin)).join("");

    zoneOnglet.querySelectorAll("[data-traiter]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        const [demandeId, statut] = bouton.dataset.traiter.split("|");
        const carte = bouton.closest(".carte");
        const reponse = carte.querySelector(".reponse-admin-champ").value.trim();
        const moiId = await idProfilCourant();

        await supabase
          .from("prets_demandes")
          .update({
            statut,
            reponse_admin: reponse || null,
            traite_par: moiId,
            traite_le: new Date().toISOString(),
            date_octroi: statut === "acceptee" ? new Date().toISOString().slice(0, 10) : null,
          })
          .eq("id", demandeId);

        notifier(`Une demande de prêt a été ${statut === "acceptee" ? "acceptée" : "refusée"}.`);
        rendreDemandes();
      });
    });

    zoneOnglet.querySelectorAll("[data-supprimer-demande-admin]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        if (!window.confirm("Supprimer définitivement cette demande refusée ? Cette action est irréversible.")) return;
        await supabase.from("prets_demandes").delete().eq("id", bouton.dataset.supprimerDemandeAdmin);
        rendreDemandes();
      });
    });
  }

  function gabaritDemande(d, estAdmin) {
    return `
      <div class="carte">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
          <div>
            <p style="margin:0; font-weight:500">${d.profils?.nom || "—"}</p>
            <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">${formaterDate(d.cree_le)}</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px">
            ${badgeStatut(d.statut)}
            ${estAdmin && d.statut === "refusee" ? `<button data-supprimer-demande-admin="${d.id}" class="bouton-icone" aria-label="Supprimer définitivement" style="color:var(--danger)">✕</button>` : ""}
          </div>
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

  async function rendrePretsEnCours() {
    zoneOnglet.innerHTML = `<p class="chargement">Chargement…</p>`;

    const { data: prets, error } = await supabase
      .from("prets_demandes")
      .select("id, montant, date_octroi, profils!prets_demandes_membre_id_fkey(nom)")
      .eq("statut", "acceptee")
      .eq("solde", false)
      .order("date_octroi");

    if (error) {
      zoneOnglet.innerHTML = `<p style="color:var(--danger)">Erreur : ${error.message}</p>`;
      return;
    }

    if (!prets || !prets.length) {
      zoneOnglet.innerHTML = `<p style="color:var(--texte-secondaire)">Aucun prêt en cours pour le moment.</p>`;
      return;
    }

    const { data: remboursements } = await supabase
      .from("prets_remboursements")
      .select("id, demande_id, montant, date_remboursement, statut")
      .order("date_remboursement", { ascending: false });

    zoneOnglet.innerHTML = prets
      .map((pret) => {
        const rembDuPret = (remboursements || []).filter((r) => r.demande_id === pret.id);
        const rembValide = rembDuPret.filter((r) => r.statut === "valide").reduce((s, r) => s + Number(r.montant), 0);
        const rembEnAttente = rembDuPret.filter((r) => r.statut === "en_attente");
        const { moisEnRetard, penalite } = calculerPenalite(pret.montant, pret.date_octroi);
        const resteDu = Number(pret.montant) + penalite - rembValide;

        return `
        <div class="carte">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
            <div>
              <p style="margin:0; font-weight:500">${pret.profils?.nom || "—"}</p>
              <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">Octroyé le ${formaterDate(pret.date_octroi)}</p>
            </div>
            <button data-marquer-solde="${pret.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 10px; font-size:12px">
              Marquer soldé
            </button>
          </div>
          <div style="display:flex; gap:16px; margin-top:10px; flex-wrap:wrap">
            <div><p style="margin:0; font-size:11px; color:var(--texte-secondaire)">EMPRUNTÉ</p><p style="margin:2px 0 0">${Number(pret.montant).toLocaleString("fr-FR")} FCFA</p></div>
            <div><p style="margin:0; font-size:11px; color:var(--texte-secondaire)">PÉNALITÉ (${moisEnRetard} mois de retard)</p><p style="margin:2px 0 0; color:${penalite > 0 ? "var(--danger)" : "var(--texte)"}">${penalite.toLocaleString("fr-FR")} FCFA</p></div>
            <div><p style="margin:0; font-size:11px; color:var(--texte-secondaire)">REMBOURSÉ</p><p style="margin:2px 0 0; color:#4C9A6A">${rembValide.toLocaleString("fr-FR")} FCFA</p></div>
            <div><p style="margin:0; font-size:11px; color:var(--texte-secondaire)">RESTE DÛ</p><p style="margin:2px 0 0; font-weight:600">${resteDu.toLocaleString("fr-FR")} FCFA</p></div>
          </div>

          ${
            rembEnAttente.length
              ? `<p style="font-size:12px; color:var(--texte-secondaire); margin:12px 0 6px">Remboursements en attente</p>` +
                rembEnAttente
                  .map(
                    (r) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-top:1px solid var(--bordure)">
                  <p style="margin:0; font-size:13px">${Number(r.montant).toLocaleString("fr-FR")} FCFA · ${formaterDate(r.date_remboursement)}</p>
                  <div style="display:flex; gap:6px">
                    <button data-valider-remb="${r.id}" class="bouton" style="background:#4C9A6A; color:#fff; padding:5px 10px; font-size:12px">Valider</button>
                    <button data-rejeter-remb="${r.id}" class="bouton" style="background:var(--danger); color:#fff; padding:5px 10px; font-size:12px">Rejeter</button>
                  </div>
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

    zoneOnglet.querySelectorAll("[data-marquer-solde]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        if (!window.confirm("Marquer ce prêt comme entièrement soldé ?")) return;
        await supabase.from("prets_demandes").update({ solde: true }).eq("id", bouton.dataset.marquerSolde);
        rendrePretsEnCours();
      });
    });

    zoneOnglet.querySelectorAll("[data-valider-remb]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        const moiId = await idProfilCourant();
        await supabase
          .from("prets_remboursements")
          .update({ statut: "valide", valide_par: moiId, valide_le: new Date().toISOString() })
          .eq("id", bouton.dataset.validerRemb);
        rendrePretsEnCours();
      });
    });

    zoneOnglet.querySelectorAll("[data-rejeter-remb]").forEach((bouton) => {
      bouton.addEventListener("click", async () => {
        const moiId = await idProfilCourant();
        await supabase
          .from("prets_remboursements")
          .update({ statut: "rejete", valide_par: moiId, valide_le: new Date().toISOString() })
          .eq("id", bouton.dataset.rejeterRemb);
        rendrePretsEnCours();
      });
    });
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
