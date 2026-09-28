// =========================================================
// CEAI — Écran admin "Gestion des cotisations"
// Plusieurs sessions peuvent être ouvertes en même temps.
// Une session clôturée disparaît de cet écran et n'est plus
// visible que dans les Archives de cotisation. Avant de
// clôturer, l'admin remplit un bilan (dépenses, remboursements
// de prêts, réalisations) qui sera lisible par tous les membres
// dans les Archives.
// =========================================================
import { supabase } from "../supabase-client.js";
import { idProfilCourant } from "../mon-profil.js";
import { notifier } from "../notifier.js";

function formaterDate(dateIso) {
  return dateIso ? new Date(dateIso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export async function ecranAdminCotisations(conteneur) {
  conteneur.innerHTML = `<h2 class="titre-section">Gestion des cotisations</h2><hr class="trait-or" /><p class="chargement">Chargement…</p>`;
  await rafraichir(conteneur);
}

async function rafraichir(conteneur) {
  const moiId = await idProfilCourant();

  const [{ data: sessions }, { data: versements }, { data: adhesions }, { data: membres }] = await Promise.all([
    supabase
      .from("cotisation_sessions")
      .select("id, nom, statut, ouverte_le, cloturee_le, montant_indicatif")
      .eq("statut", "ouverte")
      .order("ouverte_le", { ascending: false }),
    supabase.from("cotisation_versements").select("id, session_id, membre_id, montant, date_versement, statut"),
    supabase.from("cotisation_adhesions").select("session_id, membre_id").not("session_id", "is", null),
    supabase.from("profils").select("id, nom").eq("actif", true),
  ]);

  const nomParId = Object.fromEntries((membres || []).map((m) => [m.id, m.nom]));

  conteneur.innerHTML = `
    <h2 class="titre-section">Gestion des cotisations</h2>
    <hr class="trait-or" />

    <button id="bouton-nouvelle-session" class="bouton bouton-or" style="margin-bottom:16px">+ Ouvrir une nouvelle session</button>
    <div id="formulaire-session-conteneur"></div>

    <div id="liste-sessions"></div>
  `;

  document.getElementById("bouton-nouvelle-session").addEventListener("click", () => {
    document.getElementById("formulaire-session-conteneur").innerHTML = `
      <form id="formulaire-ouverture-session" class="carte" style="display:flex; flex-direction:column; gap:12px">
        <label class="champ">
          <span>Nom de la session (ex: Janvier 2026)</span>
          <input type="text" name="nom" required />
        </label>
        <label class="champ">
          <span>Montant indicatif (FCFA, facultatif)</span>
          <input type="number" name="montant_indicatif" min="1" />
        </label>
        <p id="erreur-ouverture" style="color:var(--danger); font-size:13px; margin:0" hidden></p>
        <button type="submit" class="bouton bouton-or">Ouvrir la session</button>
      </form>
    `;
    document.getElementById("formulaire-ouverture-session").addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const donnees = new FormData(evenement.target);
      const nom = donnees.get("nom").trim();
      const montantIndicatif = donnees.get("montant_indicatif");
      const erreur = document.getElementById("erreur-ouverture");

      const { error } = await supabase.from("cotisation_sessions").insert({
        nom,
        ouverte_par: moiId,
        montant_indicatif: montantIndicatif ? Number(montantIndicatif) : null,
      });
      if (error) {
        erreur.textContent = "Erreur : " + error.message;
        erreur.hidden = false;
        return;
      }
      notifier(`Nouvelle session de cotisation ouverte : ${nom}`);
      rafraichir(conteneur);
    });
  });

  const listeSessions = document.getElementById("liste-sessions");
  if (!sessions || !sessions.length) {
    listeSessions.innerHTML = `<p style="color:var(--texte-secondaire)">Aucune session ouverte pour le moment. Les sessions clôturées se trouvent dans les Archives.</p>`;
    return;
  }

  listeSessions.innerHTML = sessions
    .map((s) => {
      const versementsSession = (versements || []).filter((v) => v.session_id === s.id);
      const totalValide = versementsSession.filter((v) => v.statut === "valide").reduce((sum, v) => sum + Number(v.montant), 0);
      const enAttente = versementsSession.filter((v) => v.statut === "en_attente");
      const adherentsSession = (adhesions || []).filter((a) => a.session_id === s.id);

      return `
      <div class="carte">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px">
          <div>
            <p style="margin:0; font-weight:500">${s.nom}</p>
            <p style="margin:4px 0 0; font-size:12px; color:var(--texte-secondaire)">
              Ouverte le ${formaterDate(s.ouverte_le)} · ${totalValide.toLocaleString("fr-FR")} FCFA validés
              ${s.montant_indicatif ? ` · Indicatif : ${Number(s.montant_indicatif).toLocaleString("fr-FR")} FCFA` : ""}
            </p>
          </div>
          <span style="font-size:11px; color:#4C9A6A; border:1px solid currentColor; padding:2px 8px; border-radius:999px; white-space:nowrap">
            Ouverte
          </span>
        </div>

        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
          <button data-basculer-adherents="${s.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
            Adhérents (${adherentsSession.length})
          </button>
          <button data-basculer-liste="${s.id}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte); padding:6px 12px; font-size:13px">
            Versements en attente (${enAttente.length})
          </button>
          <button data-ouvrir-bilan="${s.id}" data-nom="${s.nom}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 12px; font-size:13px">Clôturer</button>
          <button data-supprimer="${s.id}" data-nom="${s.nom}" class="bouton" style="background:var(--fond-carte-claire); color:var(--danger); padding:6px 12px; font-size:13px">
            Supprimer
          </button>
        </div>

        <div data-liste-adherents="${s.id}" hidden style="margin-top:12px; display:flex; flex-direction:column; gap:6px">
          ${
            adherentsSession.length
              ? adherentsSession.map((a) => `<p style="margin:0; font-size:13px; padding:6px 0; border-top:1px solid var(--bordure)">${nomParId[a.membre_id] || "—"}</p>`).join("")
              : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun adhérent pour le moment.</p>`
          }
        </div>

        <div data-liste-versements="${s.id}" hidden style="margin-top:12px; display:flex; flex-direction:column; gap:8px">
          ${
            enAttente.length
              ? enAttente.map((v) => gabaritVersementEnAttente(v, nomParId)).join("")
              : `<p style="color:var(--texte-secondaire); font-size:13px">Aucun versement en attente.</p>`
          }
        </div>

        <div data-formulaire-bilan="${s.id}" hidden style="margin-top:16px; padding-top:16px; border-top:1px solid var(--bordure)">
          ${gabaritFormulaireBilan(s.id, s.nom)}
        </div>
      </div>
    `;
    })
    .join("");

  listeSessions.querySelectorAll("[data-basculer-adherents]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeSessions.querySelector(`[data-liste-adherents="${bouton.dataset.basculerAdherents}"]`);
      zone.hidden = !zone.hidden;
    });
  });

  listeSessions.querySelectorAll("[data-basculer-liste]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeSessions.querySelector(`[data-liste-versements="${bouton.dataset.basculerListe}"]`);
      zone.hidden = !zone.hidden;
    });
  });

  listeSessions.querySelectorAll("[data-ouvrir-bilan]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const zone = listeSessions.querySelector(`[data-formulaire-bilan="${bouton.dataset.ouvrirBilan}"]`);
      zone.hidden = !zone.hidden;
      if (!zone.hidden) zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  listeSessions.querySelectorAll("[data-annuler-bilan]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      listeSessions.querySelector(`[data-formulaire-bilan="${bouton.dataset.annulerBilan}"]`).hidden = true;
    });
  });

  listeSessions.querySelectorAll("[data-formulaire-bilan-cotisation]").forEach((formulaire) => {
    formulaire.addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const sessionId = formulaire.dataset.formulaireBilanCotisation;
      const nomSession = sessions.find((s) => s.id === sessionId)?.nom || "";
      const donnees = new FormData(evenement.target);
      const erreur = formulaire.querySelector(".erreur-bilan");
      erreur.hidden = true;

      if (!window.confirm(`Confirmer la clôture de "${nomSession}" ? Cette action est définitive.`)) return;

      const { error: erreurBilan } = await supabase.from("cotisation_bilans").insert({
        session_id: sessionId,
        depenses_montant: Number(donnees.get("depenses_montant")) || 0,
        depenses_description: donnees.get("depenses_description")?.trim() || null,
        remboursements_montant: Number(donnees.get("remboursements_montant")) || 0,
        remboursements_description: donnees.get("remboursements_description")?.trim() || null,
        realisations_montant: Number(donnees.get("realisations_montant")) || 0,
        realisations_description: donnees.get("realisations_description")?.trim() || null,
        rempli_par: moiId,
      });

      if (erreurBilan) {
        erreur.textContent = "Erreur (bilan) : " + erreurBilan.message;
        erreur.hidden = false;
        return;
      }

      const { data: sessionCloturee, error: erreurCloture } = await supabase
        .from("cotisation_sessions")
        .update({ statut: "cloturee", cloturee_par: moiId, cloturee_le: new Date().toISOString() })
        .eq("id", sessionId)
        .select();

      if (erreurCloture || !sessionCloturee || !sessionCloturee.length) {
        erreur.textContent = "La clôture a échoué : " + (erreurCloture?.message || "aucune ligne modifiée (droits insuffisants ?)");
        erreur.hidden = false;
        return;
      }

      notifier(`La session de cotisation "${nomSession}" a été clôturée.`);
      rafraichir(conteneur);
    });
  });

  listeSessions.querySelectorAll("[data-supprimer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer définitivement "${bouton.dataset.nom}" et tous ses versements ? Cette action est irréversible.`)) return;
      const { error } = await supabase.from("cotisation_sessions").delete().eq("id", bouton.dataset.supprimer);
      if (error) {
        alert("Erreur : " + error.message);
        return;
      }
      rafraichir(conteneur);
    });
  });

  listeSessions.querySelectorAll("[data-valider]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("cotisation_versements")
        .update({ statut: "valide", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.valider);
      rafraichir(conteneur);
    });
  });

  listeSessions.querySelectorAll("[data-rejeter]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      await supabase
        .from("cotisation_versements")
        .update({ statut: "rejete", valide_par: moiId, valide_le: new Date().toISOString() })
        .eq("id", bouton.dataset.rejeter);
      rafraichir(conteneur);
    });
  });
}

function gabaritFormulaireBilan(sessionId, nomSession) {
  return `
    <form data-formulaire-bilan-cotisation="${sessionId}" style="display:flex; flex-direction:column; gap:14px">
      <p style="margin:0; font-weight:500">Bilan de clôture — ${nomSession}</p>
      <p style="margin:0; font-size:12px; color:var(--texte-secondaire)">
        Ce bilan sera visible par tous les membres dans les Archives. Laissez à 0 ce qui ne s'applique pas.
      </p>

      <div>
        <p style="margin:0 0 6px; font-size:13px; font-weight:500">Dépenses effectuées</p>
        <input type="number" name="depenses_montant" min="0" step="1" placeholder="Montant (FCFA)"
               style="width:100%; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
        <textarea name="depenses_description" rows="2" placeholder="Détail des dépenses (facultatif)"
                  style="width:100%; margin-top:6px; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-family:inherit; font-size:13px; resize:vertical"></textarea>
      </div>

      <div>
        <p style="margin:0 0 6px; font-size:13px; font-weight:500">Remboursements de prêts effectués avec cette cotisation</p>
        <input type="number" name="remboursements_montant" min="0" step="1" placeholder="Montant (FCFA)"
               style="width:100%; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
        <textarea name="remboursements_description" rows="2" placeholder="Détail (facultatif)"
                  style="width:100%; margin-top:6px; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-family:inherit; font-size:13px; resize:vertical"></textarea>
      </div>

      <div>
        <p style="margin:0 0 6px; font-size:13px; font-weight:500">Réalisations faites avec cette cotisation</p>
        <input type="number" name="realisations_montant" min="0" step="1" placeholder="Montant (FCFA)"
               style="width:100%; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-size:13px" />
        <textarea name="realisations_description" rows="2" placeholder="Détail (facultatif)"
                  style="width:100%; margin-top:6px; background:var(--fond); border:1px solid var(--bordure); border-radius:var(--rayon-petit); padding:9px 10px; color:var(--texte); font-family:inherit; font-size:13px; resize:vertical"></textarea>
      </div>

      <p class="erreur-bilan" style="color:var(--danger); font-size:13px; margin:0" hidden></p>

      <div style="display:flex; gap:8px">
        <button type="submit" class="bouton" style="background:var(--danger); color:#fff; flex:1">Confirmer la clôture</button>
        <button type="button" data-annuler-bilan="${sessionId}" class="bouton" style="background:var(--fond-carte-claire); color:var(--texte)">Annuler</button>
      </div>
    </form>
  `;
}

function gabaritVersementEnAttente(v, nomParId) {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--bordure)">
      <div>
        <p style="margin:0; font-weight:500; font-size:14px">${nomParId[v.membre_id] || "—"}</p>
        <p style="margin:2px 0 0; font-size:12px; color:var(--texte-secondaire)">
          ${Number(v.montant).toLocaleString("fr-FR")} FCFA · ${new Date(v.date_versement).toLocaleDateString("fr-FR")}
        </p>
      </div>
      <div style="display:flex; gap:6px">
        <button data-valider="${v.id}" class="bouton" style="background:#4C9A6A; color:#fff; padding:6px 10px; font-size:12px">Valider</button>
        <button data-rejeter="${v.id}" class="bouton" style="background:var(--danger); color:#fff; padding:6px 10px; font-size:12px">Rejeter</button>
      </div>
    </div>
  `;
                                                  }
